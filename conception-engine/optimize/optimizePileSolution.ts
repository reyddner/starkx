/**
 * Otimização Ø × L × n usando calculation-engine + pile-group-engine + Converse-Labarre.
 * Score: segurança (gate) → utilização → economia (volume) → execução (n, L).
 */

import { calculate } from "../../calculation-engine/index";
import {
  allDiametersForPileType,
  diametersForPileType,
  pileTypesInCategory,
  categoryOfPileType,
  type PileCategoryId,
} from "../../calculation-engine/pile-catalog";
import { PILE_TYPES } from "../../calculation-engine/catalogs";
import type { CalculationMode, GoverningRule, MethodId } from "../../calculation-engine/types";
import { flatStoreToGeotechnicalInput } from "../../domain/adapters/from-flat-ui";
import { suggestPileGroupLayout } from "../../pile-group-engine/index";
import { suggestEfficiencyConverseLabarre } from "../../block-engine/efficiency";
import { defaultSpacing_m, minSpacingFactorForPileType } from "../../block-engine/index";
import { interpretSoilProfile, type InterpretLayer } from "../profile/interpretSoilProfile";
import {
  relativePileCost,
  scorePileCandidate,
  type ScoreContext,
} from "./scorePileCandidate";
import type {
  ConceptionPileResult,
  ConceptionRole,
  PileSolutionCandidate,
} from "../types";

export interface OptimizePileInput {
  layers: InterpretLayer[];
  N_kN: number;
  Mx_kNm?: number;
  My_kNm?: number;
  /** Tipo atual (preferido); a busca também avalia outros da mesma categoria. */
  preferredPileTypeId: number;
  /** Incluir outros tipos da categoria (default true). */
  searchCategory?: boolean;
  mode?: CalculationMode;
  governingRule?: GoverningRule;
  selectedMethod?: MethodId;
  aoki?: { fs: number; pctTip: number; pctShaft: number };
  decourt?: { alphaPct?: number; betaPct?: number };
  teixeira?: { fs: number; pctTip: number; pctShaft: number };
  waterLevel_m?: number | null;
  pileTopDepth_m?: number;
  /** Topo sob bloco (m) — usado quando n>1 para L coerente com DEC-57. */
  pileTopDepthCap_m?: number;
  /** Se informado, busca só neste diâmetro (padronização multi-pilar). */
  fixedDiameterCm?: number;
  /** Se true e perfil raso competente, marca preferShallow. */
  preferShallowIfViable?: boolean;
  softShallowHint?: boolean;
}

/** NSPT da camada que contém a cota da ponta (camadas ordenadas por profundidade). */
function nsptAtDepth(layers: InterpretLayer[], depth_m: number): number | null {
  const sorted = [...layers]
    .filter((l) => Number.isFinite(l.depth_m) && Number.isFinite(l.nspt))
    .sort((a, b) => a.depth_m - b.depth_m);
  for (const l of sorted) {
    if (depth_m <= l.depth_m + 1e-9) return l.nspt;
  }
  return null;
}

function candidatePileTypeIds(preferred: number, searchCategory: boolean): number[] {
  const pref = PILE_TYPES.find((p) => p.id === preferred);
  if (!pref) return [6];
  if (pref.requiresManualArea || pref.requiresEnlargedBase) {
    // Franki / metálica / madeira — mantém só o tipo atual nesta onda
    return [preferred];
  }
  if (!searchCategory) return [preferred];
  const cat: PileCategoryId = categoryOfPileType(preferred);
  return pileTypesInCategory(cat)
    .filter((p) => !p.requiresManualArea && !p.requiresEnlargedBase)
    .map((p) => p.id);
}

/** Limites práticos para concepção automática (Ø ≥ 25 cm; teto por tipo). */
const MIN_DIAMETER_CM = 25;

function practicalDiametersCm(pileTypeId: number, catalog: number[]): number[] {
  const maxByType: Record<number, number> = {
    1: 50,
    2: 50,
    3: 40,
    4: 50,
    5: 45,
    6: 80,
    7: 80,
    8: 25,
    9: 60,
    10: 31,
    11: 70,
  };
  const max = maxByType[pileTypeId] ?? 50;
  const filtered = catalog.filter(
    (d) => d >= MIN_DIAMETER_CM - 1e-9 && d <= max + 1e-9,
  );
  if (filtered.length > 0) return filtered;
  // Fallback: se o catálogo só tiver Ø < 25, não inventa — retorna vazio.
  return [];
}

export function optimizePileSolution(input: OptimizePileInput): ConceptionPileResult {
  const profile = interpretSoilProfile(input.layers);
  const N = input.N_kN;
  const Mx = input.Mx_kNm ?? 0;
  const My = input.My_kNm ?? 0;
  const mode = input.mode ?? "engineering";
  const pileTopIsolated_m = Math.max(0, input.pileTopDepth_m ?? 0);
  const pileTopCap_m = Math.max(
    pileTopIsolated_m,
    input.pileTopDepthCap_m ?? pileTopIsolated_m,
  );

  const preferShallow =
    (input.preferShallowIfViable ?? true) &&
    !profile.weakShallow &&
    !(input.softShallowHint ?? false) &&
    N > 0 &&
    N <= 800 &&
    profile.meanNspt >= 10;

  if (!(N > 0) || profile.layerCount === 0) {
    return {
      profile,
      recommended: null,
      alternatives: [],
      topOptions: [],
      evaluatedCount: 0,
      confidence: "low",
      summary: "Informe sondagem e carga N do pilar para concepção automática.",
      preferShallow: false,
      shallowNote: null,
    };
  }

  // Cotas SPT com L ≥ 1 m (isolada ou sob bloco). L≥3 entra no score, não no gate —
  // senão sondagem rasa + bloco zerava todas as opções.
  const MIN_L_M = 1;
  const tipCandidates = input.layers
    .map((l) => l.depth_m)
    .filter((d) => {
      const Liso = d - pileTopIsolated_m;
      const Lcap = d - pileTopCap_m;
      return (
        Math.max(Liso, Lcap) >= MIN_L_M - 1e-9 && d <= profile.maxDepth_m + 1e-9
      );
    })
    .sort((a, b) => a - b);

  const uniqueTips = [...new Set(tipCandidates.map((d) => Number(d.toFixed(3))))];
  // Limita profundidades para performance: todas as cotas SPT no intervalo, máx 20
  const tips = uniqueTips.length > 20
    ? uniqueTips.filter((_, i) => i % Math.ceil(uniqueTips.length / 20) === 0)
    : uniqueTips;

  const typeIds = candidatePileTypeIds(input.preferredPileTypeId, input.searchCategory !== false);
  const raw: PileSolutionCandidate[] = [];

  for (const pileTypeId of typeIds) {
    let catalog = allDiametersForPileType(pileTypeId);
    if (catalog.length === 0) catalog = diametersForPileType(pileTypeId);
    if (catalog.length === 0) continue;
    const practical = practicalDiametersCm(pileTypeId, catalog);
    const diameterList =
      input.fixedDiameterCm != null && input.fixedDiameterCm > 0
        ? practical.filter((d) => d === input.fixedDiameterCm)
        : practical;
    if (diameterList.length === 0) continue;
    for (const diameterCm of diameterList) {
      for (const sptTip of tips) {
        // Padm depende da cota SPT absoluta — calcula com topo isolado.
        const tipIso_m = Number((sptTip - pileTopIsolated_m).toFixed(3));
        if (tipIso_m < MIN_L_M - 1e-9) continue;
        try {
          const geo = flatStoreToGeotechnicalInput(
            {
              pileTypeId,
              diameterCm,
              tipDepth_m: tipIso_m,
              pileTopDepth_m: pileTopIsolated_m,
              waterLevel_m: input.waterLevel_m ?? null,
              layers: input.layers.map((l) => ({
                depth_m: l.depth_m,
                nspt: l.nspt,
                soilTypeId: l.soilTypeId ?? 12,
              })),
              designLoad_kN: null,
            },
            {
              mode,
              governingRule: input.governingRule ?? "minimum",
              selectedMethod: input.selectedMethod,
              aoki: input.aoki,
              decourt: input.decourt,
              teixeira: input.teixeira,
              pileTopDepth_m: pileTopIsolated_m,
            },
          );
          const r = calculate(geo);
          const padm = r.atTip.governingPadm_kN;
          if (!(padm > 0)) continue;

          const diameter_m = diameterCm / 100;
          const spacing = defaultSpacing_m(diameter_m, minSpacingFactorForPileType(pileTypeId));
          const layout = suggestPileGroupLayout({
            N_kN: N,
            Mx_kNm: Mx,
            My_kNm: My,
            singlePadm_kN: padm,
            diameter_m,
            spacing_m: spacing,
            efficiency: null,
            pileTypeId,
          });

          const groupEta = suggestEfficiencyConverseLabarre({
            rows: layout.rows,
            cols: layout.cols,
            diameter_m,
            spacing_m: spacing,
          });

          const layout2 =
            layout.nPiles > 1
              ? suggestPileGroupLayout({
                  N_kN: N,
                  Mx_kNm: Mx,
                  My_kNm: My,
                  singlePadm_kN: padm,
                  diameter_m,
                  spacing_m: spacing,
                  efficiency: groupEta.eta,
                  pileTypeId,
                })
              : layout;

          const top_m = layout2.nPiles > 1 ? pileTopCap_m : pileTopIsolated_m;
          const tipDepth_m = Number((sptTip - top_m).toFixed(3));
          if (tipDepth_m < MIN_L_M - 1e-9) continue;

          const eta = layout2.nPiles > 1 ? groupEta.eta : 1;
          const groupPadm_kN = layout2.nPiles * padm * eta;
          const utilization = groupPadm_kN > 0 ? N / groupPadm_kN : 99;
          const area_m2 = (Math.PI * diameter_m * diameter_m) / 4;
          const totalLength_m = layout2.nPiles * tipDepth_m;
          const pileConcrete_m3 = Number((totalLength_m * area_m2).toFixed(3));
          const tipNspt = nsptAtDepth(input.layers, sptTip);
          const bearsOnResistantLayer =
            profile.resistantOnset_m != null && sptTip >= profile.resistantOnset_m - 1e-9;
          const slenderness = Number((tipDepth_m / diameter_m).toFixed(1));

          raw.push({
            pileTypeId,
            diameterCm,
            tipDepth_m,
            padmGoverning_kN: Number(padm.toFixed(1)),
            rows: layout2.rows,
            cols: layout2.cols,
            nPiles: layout2.nPiles,
            efficiency: Number(eta.toFixed(3)),
            groupPadm_kN: Number(groupPadm_kN.toFixed(1)),
            utilization: Number(utilization.toFixed(3)),
            totalLength_m: Number(totalLength_m.toFixed(2)),
            pileConcrete_m3,
            tipNspt,
            bearsOnResistantLayer,
            slenderness,
            ok: layout2.trial.ok && utilization <= 1.001,
            score: 0,
            scoreBreakdown: { safety: 0, efficiency: 0, economy: 0, execution: 0, bearing: 0 },
            rationale: "",
          });
        } catch {
          // Cota/Ø inválidos para o motor — ignora candidato
        }
      }
    }
  }

  const viable = raw.filter((c) => c.ok);
  const pool = viable.length > 0 ? viable : raw;
  const costs = pool.map((c) => relativePileCost(c));
  const ctx: ScoreContext = {
    resistantOnset_m: profile.resistantOnset_m,
    costMin: costs.length > 0 ? Math.min(...costs) : 0,
    costMax: costs.length > 0 ? Math.max(...costs) : 1,
    N_kN: N,
    profileMaxDepth_m: profile.maxDepth_m,
  };

  const scored = pool.map((c) => {
    const sc = scorePileCandidate(c, ctx);
    return { ...c, ...sc };
  });
  // Preferência forte ao tipo já escolhido (evita saltar p/ Estacão sem necessidade).
  const preferredBoost = scored.map((c) =>
    c.pileTypeId === input.preferredPileTypeId ? { ...c, score: c.score + 0.85 } : c,
  );
  // Desempate: apoio em camada resistente, depois menor custo relativo.
  preferredBoost.sort(
    (a, b) =>
      b.score - a.score ||
      Number(b.bearsOnResistantLayer) - Number(a.bearsOnResistantLayer) ||
      relativePileCost(a) - relativePileCost(b),
  );

  const okPool = preferredBoost.filter((c) => c.ok);
  const recommended =
    profile.maxDepth_m >= 4 - 1e-9
      ? (okPool.find((c) => c.tipDepth_m >= 3 - 1e-9) ?? okPool[0] ?? null)
      : (okPool[0] ?? null);

  const alternatives: ConceptionPileResult["alternatives"] = [];
  if (recommended) {
    alternatives.push({ role: "recommended", candidate: recommended });

    const economic = [...preferredBoost]
      .filter((c) => c.diameterCm >= MIN_DIAMETER_CM)
      .sort((a, b) => relativePileCost(a) - relativePileCost(b) || b.score - a.score)[0];
    if (economic && economic !== recommended) {
      alternatives.push({ role: "economic", candidate: economic });
    }

    const conservative = [...preferredBoost]
      .filter((c) => c.utilization <= 0.7 && c.diameterCm >= MIN_DIAMETER_CM)
      .sort((a, b) => a.utilization - b.utilization || b.score - a.score)[0];
    if (conservative && !alternatives.some((a) => a.candidate === conservative)) {
      alternatives.push({ role: "conservative", candidate: conservative });
    }

    const minimalExec = [...preferredBoost]
      .filter((c) => c.diameterCm >= MIN_DIAMETER_CM)
      .sort(
        (a, b) =>
          a.nPiles - b.nPiles || a.tipDepth_m - b.tipDepth_m || b.score - a.score,
      )[0];
    if (minimalExec && !alternatives.some((a) => a.candidate === minimalExec)) {
      alternatives.push({ role: "minimal_execution", candidate: minimalExec });
    }
  }

  // Opções exploráveis: dedupe Ø×L×n×tipo, top 15 por score.
  const seen = new Set<string>();
  const topOptions: PileSolutionCandidate[] = [];
  for (const c of preferredBoost) {
    if (!c.ok || c.diameterCm < MIN_DIAMETER_CM) continue;
    const key = `${c.pileTypeId}|${c.diameterCm}|${c.tipDepth_m}|${c.nPiles}`;
    if (seen.has(key)) continue;
    seen.add(key);
    topOptions.push(c);
    if (topOptions.length >= 15) break;
  }

  let summary = "Nenhuma solução viável encontrada com o perfil/carga atuais.";
  if (recommended == null) {
    if (profile.maxDepth_m < 4) {
      summary =
        `A sondagem só vai até ${profile.maxDepth_m.toFixed(1)} m — curta para a carga de ${N.toFixed(0)} kN. ` +
        "Complete as camadas SPT até a cota de apoio ou reduza N.";
    } else if (raw.length === 0) {
      summary = "Não foi possível avaliar candidatos com este perfil. Confira tipo, Ø e camadas SPT.";
    } else {
      summary =
        `Nenhuma combinação Ø×L×n atende ${N.toFixed(0)} kN neste perfil (NSPT raso ou ponta curta). ` +
        "Aumente a sondagem, o diâmetro ou o número de estacas.";
    }
  } else {
    const typeName = PILE_TYPES.find((p) => p.id === recommended.pileTypeId)?.name ?? `tipo ${recommended.pileTypeId}`;
    summary =
      `Recomendado: ${recommended.nPiles} estaca(s) ${typeName} Ø${recommended.diameterCm} cm × ${recommended.tipDepth_m.toFixed(1)} m ` +
      `(Padm ${recommended.padmGoverning_kN.toFixed(0)} kN · utilização ${(recommended.utilization * 100).toFixed(0)}% · score ${recommended.score}). ` +
      (profile.resistantOnset_m != null
        ? `Perfil sugere apoio a partir de ~${profile.resistantOnset_m.toFixed(1)} m. `
        : "") +
      recommended.rationale;
  }

  return {
    profile,
    recommended,
    alternatives,
    topOptions,
    evaluatedCount: raw.length,
    confidence: profile.confidence,
    summary,
    preferShallow,
    shallowNote: preferShallow
      ? "Perfil raso relativamente competente e carga moderada — sapata isolada pode ser alternativa; confirme na análise DEC-56."
      : null,
  };
}

export type { ConceptionRole };
