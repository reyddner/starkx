/**
 * Sugestão heurística de tipo de fundação (DEC-54/55/56).
 * Chama footing-engine para teste de sapata; NÃO grava fundação nem calcula Padm.
 * DEC-56: usa sondagem (NSPT raso + NA) para σadm indicativo e veto de sapata em solo fraco.
 * O ensaio também olha o bulbo de tensões (≈ 2B abaixo da base): camada mole ali veta a
 * sapata, e o σadm vem do NSPT médio do bulbo quando ele for menor que o raso.
 */

import { designFooting } from "../footing-engine/design";

/** Alinhado a FoundationKindUi da UI — definido aqui para não acoplar assist→web. */
export type SuggestableFoundationKind =
  | "pile"
  | "pile_cap"
  | "footing"
  | "caisson"
  | "raft";

export interface SuggestColumnLoad {
  id: string;
  columnLabel: string;
  N_kN: number | null;
  Mx_kNm: number | null;
  My_kNm: number | null;
  /** Dimensões do pilar (m); default do footing-engine (0,30 m). */
  columnWidth_m?: number | null;
  columnDepth_m?: number | null;
}

export interface SuggestSoilLayer {
  depth_m: number;
  nspt: number;
}

export interface FoundationSuggestInput {
  columns: SuggestColumnLoad[];
  loadIsDesign: boolean;
  /** σadm (kPa) informado no projeto (modo user) */
  sigmaAdm_kPa: number;
  footingAspect?: number;
  maxFootingSide_m?: number;
  singlePileN_kN?: number;
  /** Camadas SPT (DEC-56) */
  layers?: SuggestSoilLayer[];
  /** NA (m) — raso desfavorece sapata */
  waterLevel_m?: number | null;
  /** Profundidade de apoio típica da sapata para média NSPT (m) */
  shallowDepth_m?: number;
  /** Cota de apoio da base da sapata (m) para o bulbo de tensões; default 1,5 m. */
  footingBaseDepth_m?: number;
}

export interface SoilProfileHint {
  shallowMeanNspt: number | null;
  shallowMinNspt: number | null;
  layerCount: number;
  /** σadm indicativo a partir do NSPT raso (kPa) — heurística, não norma */
  sigmaAdmFromSpt_kPa: number | null;
  /** σadm efetivo usado no ensaio de sapata */
  sigmaAdmEffective_kPa: number;
  softShallow: boolean;
  highWaterTable: boolean;
  notes: string[];
}

export interface ColumnFootingProbe {
  columnId: string;
  label: string;
  N_kN: number;
  footingOk: boolean;
  B_m: number | null;
  L_m: number | null;
  area_m2: number | null;
  message: string;
  suggestedKind: SuggestableFoundationKind;
}

export interface FoundationSuggestResult {
  suggestedKind: SuggestableFoundationKind;
  reasons: string[];
  alternatives: SuggestableFoundationKind[];
  probes: ColumnFootingProbe[];
  footingOkCount: number;
  pileCapNeededCount: number;
  soil: SoilProfileHint;
}

const KIND_LABEL: Record<SuggestableFoundationKind, string> = {
  footing: "sapata isolada",
  pile: "estaca isolada",
  pile_cap: "bloco sobre estacas",
  caisson: "tubulão",
  raft: "radier",
};

/**
 * σadm (kPa) ≈ 20·N̄ raso, limitado a [50, 350].
 * Ordem de grandeza didática — NÃO substitui ensaio / NBR.
 */
export function sigmaAdmFromShallowNspt(meanNspt: number): number {
  if (!(meanNspt > 0) || !Number.isFinite(meanNspt)) return 50;
  return Math.round(Math.max(50, Math.min(350, 20 * meanNspt)));
}

export function analyzeSoilProfile(
  layers: SuggestSoilLayer[] | undefined,
  waterLevel_m: number | null | undefined,
  userSigma_kPa: number,
  shallowDepth_m = 3,
): SoilProfileHint {
  const notes: string[] = [];
  const sorted = [...(layers ?? [])]
    .filter((l) => l.depth_m > 0 && l.nspt >= 0)
    .sort((a, b) => a.depth_m - b.depth_m);

  const shallow = sorted.filter((l) => l.depth_m <= shallowDepth_m);
  const sample = shallow.length > 0 ? shallow : sorted.slice(0, Math.min(3, sorted.length));

  let shallowMeanNspt: number | null = null;
  let shallowMinNspt: number | null = null;
  if (sample.length > 0) {
    const sum = sample.reduce((a, l) => a + l.nspt, 0);
    shallowMeanNspt = sum / sample.length;
    shallowMinNspt = Math.min(...sample.map((l) => l.nspt));
  }

  const softShallow =
    shallowMinNspt != null && (shallowMinNspt < 4 || (shallowMeanNspt != null && shallowMeanNspt < 6));

  const highWaterTable =
    waterLevel_m != null && Number.isFinite(waterLevel_m) && waterLevel_m >= 0 && waterLevel_m < 2;

  const sigmaAdmFromSpt_kPa =
    shallowMeanNspt != null ? sigmaAdmFromShallowNspt(shallowMeanNspt) : null;

  let sigmaAdmEffective_kPa = userSigma_kPa > 0 ? userSigma_kPa : 200;
  if (sigmaAdmFromSpt_kPa != null) {
    // Usa o menor entre informado e estimativa SPT (conservador na análise)
    sigmaAdmEffective_kPa = Math.min(sigmaAdmEffective_kPa, sigmaAdmFromSpt_kPa);
    if (userSigma_kPa > sigmaAdmFromSpt_kPa * 1.25) {
      notes.push(
        `σadm informado (${userSigma_kPa} kPa) > estimativa SPT raso (~${sigmaAdmFromSpt_kPa} kPa) — ensaio usa o menor (DEC-56).`,
      );
    } else {
      notes.push(
        `NSPT raso médio ≈ ${shallowMeanNspt!.toFixed(1)} → σadm indicativo ~${sigmaAdmFromSpt_kPa} kPa; efetivo ${sigmaAdmEffective_kPa} kPa.`,
      );
    }
  } else {
    notes.push("Sem camadas SPT — ensaio de sapata usa só σadm informado do projeto.");
  }

  if (softShallow) {
    notes.push(
      `Solo raso fraco (Nmín=${shallowMinNspt}, N̄=${shallowMeanNspt?.toFixed(1)}) — sapata desfavorecida.`,
    );
  }
  if (highWaterTable) {
    notes.push(`NA raso (${waterLevel_m} m) — atenção a escavação/saturação em fundação rasa.`);
  }

  return {
    shallowMeanNspt,
    shallowMinNspt,
    layerCount: sorted.length,
    sigmaAdmFromSpt_kPa,
    sigmaAdmEffective_kPa,
    softShallow,
    highWaterTable,
    notes,
  };
}

/** Profundidade do bulbo de tensões abaixo da base: ≈ 2B (sapata quadrada/retangular). */
export const BULB_DEPTH_FACTOR = 2;

export interface BulbHint {
  from_m: number;
  to_m: number;
  meanNspt: number;
  minNspt: number;
  minAt_m: number;
}

/** NSPT no bulbo de tensões (base … base + 2B). Null se a sondagem não chega lá. */
export function bulbNspt(
  layers: SuggestSoilLayer[] | undefined,
  baseDepth_m: number,
  B_m: number,
): BulbHint | null {
  const to_m = baseDepth_m + BULB_DEPTH_FACTOR * B_m;
  const zone = (layers ?? [])
    .filter((l) => l.depth_m > baseDepth_m && l.depth_m <= to_m + 1e-9 && l.nspt >= 0)
    .sort((a, b) => a.depth_m - b.depth_m);
  if (zone.length === 0) return null;
  const min = zone.reduce((m, l) => (l.nspt < m.nspt ? l : m), zone[0]!);
  return {
    from_m: baseDepth_m,
    to_m,
    meanNspt: zone.reduce((a, l) => a + l.nspt, 0) / zone.length,
    minNspt: min.nspt,
    minAt_m: min.depth_m,
  };
}

/**
 * Produto: com pilar, nunca sugerir estaca isolada (contato direto pilar–fuste).
 * Sem sapata viável → sempre bloco sobre estacas (1E+).
 */
function kindForProbe(footingOk: boolean, N_kN: number): SuggestableFoundationKind {
  if (!(N_kN > 0)) return "pile_cap";
  if (footingOk) return "footing";
  return "pile_cap";
}

function probeFooting(
  col: SuggestColumnLoad,
  sigmaAdm_kPa: number,
  loadIsDesign: boolean,
  aspect: number,
  maxSide: number,
  softShallow: boolean,
  layers: SuggestSoilLayer[] | undefined,
  baseDepth_m: number,
): ColumnFootingProbe {
  const N = col.N_kN ?? 0;
  const base: ColumnFootingProbe = {
    columnId: col.id,
    label: col.columnLabel || "P",
    N_kN: N,
    footingOk: false,
    B_m: null,
    L_m: null,
    area_m2: null,
    message: "",
    suggestedKind: "pile_cap",
  };
  if (!(N > 0)) {
    return { ...base, message: "Sem N — ignorado na análise.", suggestedKind: "pile_cap" };
  }
  if (softShallow) {
    const suggestedKind = kindForProbe(false, N);
    return {
      ...base,
      footingOk: false,
      suggestedKind,
      message: `Solo raso fraco (SPT) — sapata não recomendada nesta análise (DEC-56); sugere ${KIND_LABEL[suggestedKind]}.`,
    };
  }
  try {
    const size = (sigma: number) =>
      designFooting({
        Nk_kN: N,
        loadIsDesign,
        Mx_kNm: col.Mx_kNm ?? undefined,
        My_kNm: col.My_kNm ?? undefined,
        shape: aspect <= 1.01 ? "square" : "rectangular",
        aspectRatio: aspect,
        admMode: "user",
        sigmaAdm_kPa: sigma,
        thickness_m: null,
        gammaConcrete_kN_m3: 25,
        columnWidth_m: col.columnWidth_m ?? null,
        columnDepth_m: col.columnDepth_m ?? null,
      });
    // Sapata maior → bulbo mais fundo → pode pegar solo pior: itera σadm pelo bulbo.
    let sigma = sigmaAdm_kPa;
    let r = size(sigma);
    let bulb = bulbNspt(layers, baseDepth_m, r.B_m);
    for (let i = 0; i < 8 && bulb; i++) {
      const sigmaBulb = sigmaAdmFromShallowNspt(bulb.meanNspt);
      if (sigmaBulb >= sigma - 1e-6) break;
      sigma = sigmaBulb;
      r = size(sigma);
      bulb = bulbNspt(layers, baseDepth_m, r.B_m);
    }
    const sideOk = r.B_m <= maxSide && r.L_m <= maxSide;
    const checksOk = r.checks.every((c) => c.status !== "error");
    const softInBulb = bulb != null && bulb.minNspt < 4;
    const ok = sideOk && checksOk && !softInBulb;
    const suggestedKind = kindForProbe(ok, N);
    const dims = `${r.B_m.toFixed(2)}×${r.L_m.toFixed(2)} m`;
    return {
      ...base,
      footingOk: ok,
      B_m: r.B_m,
      L_m: r.L_m,
      area_m2: r.area_m2,
      suggestedKind,
      message: ok
        ? `Sapata OK ≈ ${dims} (σadm_ef=${sigma} kPa${sigma < sigmaAdm_kPa ? ", limitado pelo bulbo" : ""})`
        : softInBulb
          ? `Camada mole (NSPT=${bulb!.minNspt} a ${bulb!.minAt_m} m) no bulbo de tensões da sapata de ${dims} (até ${bulb!.to_m.toFixed(1)} m) — recalque/ruptura; favorece estacas`
          : !sideOk
            ? `Sapata grande demais (${dims} > ${maxSide} m) — favorece profundidade`
            : `Verificações da sapata com alerta/erro — revisar ou ir para estacas`,
    };
  } catch (e) {
    return {
      ...base,
      suggestedKind: kindForProbe(false, N),
      message: e instanceof Error ? e.message : "Falha no ensaio de sapata",
    };
  }
}

export function suggestFoundationKind(input: FoundationSuggestInput): FoundationSuggestResult {
  const maxSide = input.maxFootingSide_m ?? 4;
  const aspect = input.footingAspect ?? 1;
  const soil = analyzeSoilProfile(
    input.layers,
    input.waterLevel_m,
    input.sigmaAdm_kPa,
    input.shallowDepth_m ?? 3,
  );
  const sigma = soil.sigmaAdmEffective_kPa;
  const loaded = input.columns.filter((c) => c.N_kN != null && c.N_kN > 0);
  const probes = loaded.map((c) =>
    probeFooting(
      c,
      sigma,
      input.loadIsDesign,
      aspect,
      maxSide,
      soil.softShallow,
      input.layers,
      input.footingBaseDepth_m ?? 1.5,
    ),
  );

  const footingOkCount = probes.filter((p) => p.footingOk).length;
  const pileCapNeededCount = probes.length - footingOkCount;
  const reasons: string[] = [...soil.notes];
  let suggestedKind: SuggestableFoundationKind = "pile_cap";

  if (probes.length === 0) {
    reasons.push("Nenhuma carga N > 0 — sugestão padrão: bloco sobre estacas (após informar cargas).");
    suggestedKind = "pile_cap";
  } else if (soil.softShallow) {
    suggestedKind = "pile_cap";
    reasons.push(
      `Sondagem indica solo raso inadequado para sapata → ${KIND_LABEL[suggestedKind]} (DEC-56).`,
    );
  } else if (probes.length === 1) {
    const p = probes[0]!;
    suggestedKind = p.suggestedKind;
    if (p.footingOk) {
      reasons.push(`Pilar único com sapata viável (${p.message}).`);
    } else {
      reasons.push(
        `Pilar único com N=${p.N_kN} kN e sapata inviável → bloco sobre estacas (não apoia o pilar no fuste).`,
      );
      reasons.push(p.message);
    }
  } else if (footingOkCount === probes.length) {
    suggestedKind = "footing";
    reasons.push(`Todas as ${probes.length} sapatas ensaiadas OK com σadm_ef=${sigma} kPa.`);
  } else if (footingOkCount === 0) {
    suggestedKind = "pile_cap";
    reasons.push(`Nenhuma sapata passou no ensaio → bloco sobre estacas para o conjunto.`);
  } else {
    suggestedKind = "pile_cap";
    reasons.push(
      `${pileCapNeededCount}/${probes.length} pilares sem sapata viável → preferir bloco/estacas (revise por pilar).`,
    );
  }

  if (soil.highWaterTable && suggestedKind === "footing") {
    reasons.push("NA raso com sapata sugerida — confirme drenagem/nível de apoio no projeto.");
  }

  const mixed =
    probes.length > 1 && probes.some((p) => p.suggestedKind !== probes[0]!.suggestedKind);
  if (mixed) {
    reasons.push(
      "Pilares com soluções distintas sugeridas — revise um a um (DEC-55). Tipo global do projeto permanece único nesta onda.",
    );
  }

  // Sem "pile": produto não recomenda estaca isolada sob pilar.
  const alternatives: SuggestableFoundationKind[] = (
    ["footing", "pile_cap", "caisson", "raft"] as SuggestableFoundationKind[]
  ).filter((k) => k !== suggestedKind);

  reasons.push(
    `Sugestão do projeto: ${KIND_LABEL[suggestedKind]} — confirme na Fundação (DEC-54/56; não é ART).`,
  );

  return {
    suggestedKind,
    reasons,
    alternatives,
    probes,
    footingOkCount,
    pileCapNeededCount,
    soil,
  };
}

export { KIND_LABEL as foundationKindLabelPt };
