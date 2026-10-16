import { proposeRectangularCap } from "./capGeometry";
import { defaultSpacing_m, layoutRectangularGrid, minSpacingFactorForPileType } from "./layout";
import { checkPileCapPunching } from "./punching";
import { pickTieBars } from "./rebar";
import { designStrutTie } from "./strutTie";
import { pickMesh } from "../footing-engine/rebar";
import { computeBlockTakeoff } from "@structural/takeoff";
import type {
  BlockCheck,
  BlockDesignInput,
  BlockDesignResult,
  BlockTrace,
} from "./types";

const GAMMA_CONCRETE = 25;
const DEFAULT_COLUMN_M = 0.3;

/**
 * Bloco sobre estacas: geometria, reações nas estacas, capacidade do grupo e
 * dimensionamento estrutural (bielas e tirantes no bloco rígido; punção no flexível).
 * Não calcula Padm individual — recebe singlePadm_kN do calculation-engine.
 */
export function designPileCap(input: BlockDesignInput): BlockDesignResult {
  const traces: BlockTrace[] = [];
  const warnings: string[] = [];
  const checks: BlockCheck[] = [];

  const rows = Math.floor(input.rows);
  const cols = Math.floor(input.cols);
  if (rows < 1 || cols < 1) {
    throw new Error("Linhas e colunas devem ser inteiros ≥ 1");
  }
  if (!(input.diameter_m > 0)) {
    throw new Error("Diâmetro deve ser > 0");
  }

  const factor = input.minSpacingFactor ?? minSpacingFactorForPileType(input.pileTypeId ?? null);
  const absMin = input.minSpacingAbsolute_m ?? 0.8;
  const spacingMin = defaultSpacing_m(input.diameter_m, factor, absMin);
  const spacing = input.spacing_m != null && input.spacing_m > 0 ? input.spacing_m : spacingMin;

  traces.push({
    stepId: "spacing",
    title: "Espaçamento adotado",
    formula: "s = s_user ?? max(k·D, s_abs); k = 2,5 (pré-moldada/metálica) ou 3,0 (moldada in loco)",
    substitutions: {
      s_user: input.spacing_m ?? "auto",
      k: factor,
      D_m: input.diameter_m,
      s_abs_m: absMin,
      s_min_m: spacingMin,
    },
    result: spacing,
    unit: "m",
    reference: "Prática usual de projeto (NBR 6122)",
  });

  const piles = layoutRectangularGrid(rows, cols, spacing);
  const pileCount = piles.length;
  const capOutline = proposeRectangularCap(piles, input.edge_m, input.diameter_m);
  const area_m2 = capOutline.width_m * capOutline.length_m;
  traces.push({
    stepId: "cap",
    title: "Contorno do bloco",
    formula: "AABB(estacas ± D/2) + beiral",
    substitutions: {
      n: pileCount,
      edge_m: input.edge_m,
      width_m: capOutline.width_m,
      length_m: capOutline.length_m,
    },
    result: area_m2,
    unit: "m²",
    reference: "—",
  });

  checks.push({
    id: "spacing",
    title: "Espaçamento mínimo",
    status: spacing + 1e-9 < spacingMin ? "error" : "ok",
    message: `s = ${spacing.toFixed(3)} m ${spacing + 1e-9 < spacingMin ? "<" : "≥"} s_min = ${spacingMin.toFixed(3)} m`,
    value: spacing,
    limit: spacingMin,
    unit: "m",
  });
  const minEdge = input.minEdge_m ?? 0.15;
  checks.push({
    id: "edge",
    title: "Beiral mínimo",
    status: input.edge_m + 1e-9 < minEdge ? "warning" : "ok",
    message: `beiral = ${input.edge_m.toFixed(3)} m ${input.edge_m + 1e-9 < minEdge ? "<" : "≥"} ${minEdge.toFixed(3)} m`,
    value: input.edge_m,
    limit: minEdge,
    unit: "m",
  });

  // Reações de serviço (com peso próprio do bloco) — distribuição de bloco rígido.
  const toService = input.loadIsDesign ? 1 / 1.4 : 1;
  const toDesign = input.loadIsDesign ? 1 : 1.4;
  const N = input.groupLoad_kN != null && Number.isFinite(input.groupLoad_kN) ? input.groupLoad_kN : null;
  const Mx = input.Mx_kNm ?? 0;
  const My = input.My_kNm ?? 0;
  const W = GAMMA_CONCRETE * area_m2 * input.thickness_m;
  const sumX2 = piles.reduce((a, p) => a + p.position.x_m ** 2, 0);
  const sumY2 = piles.reduce((a, p) => a + p.position.y_m ** 2, 0);
  const reactions = (Nv: number, mx: number, my: number): number[] =>
    piles.map((p) => {
      let r = Nv / pileCount;
      if (sumY2 > 1e-12) r += (mx * p.position.y_m) / sumY2;
      if (sumX2 > 1e-12) r += (my * p.position.x_m) / sumX2;
      return r;
    });
  const pileLoads_kN = N != null ? reactions(N * toService + W, Mx * toService, My * toService) : [];

  const efficiencyUserProvided = input.efficiency != null && Number.isFinite(input.efficiency);
  if (efficiencyUserProvided && !(input.efficiency! > 0)) {
    throw new Error("Eficiência de grupo η deve ser > 0");
  }
  const efficiency = efficiencyUserProvided ? input.efficiency! : 1;
  const groupCapacityIndicative = !efficiencyUserProvided;
  if (groupCapacityIndicative) {
    warnings.push(
      "Padm do grupo é INDICATIVO (η=1, soma simples). Informe η (a UI sugere Converse-Labarre) para usar como verificação de projeto.",
    );
  }

  let groupPadm_kN: number | null = null;
  let capacityOk: boolean | null = null;
  if (input.singlePadm_kN != null && Number.isFinite(input.singlePadm_kN)) {
    groupPadm_kN = pileCount * input.singlePadm_kN * efficiency;
    traces.push({
      stepId: "capacity",
      title: groupCapacityIndicative ? "Capacidade do grupo (indicativa)" : "Capacidade do grupo",
      formula: "Padm_grupo = n × Padm_estaca × η",
      substitutions: {
        n: pileCount,
        Padm_estaca_kN: input.singlePadm_kN,
        eta: efficiency,
      },
      result: groupPadm_kN,
      unit: "kN",
      reference: "DEC-17",
    });
    if (N != null) {
      const Ntot = N * toService + W;
      const groupOk = groupPadm_kN + 1e-9 >= Ntot;
      const maxPile = Math.max(...pileLoads_kN);
      const pileOk = maxPile <= input.singlePadm_kN + 1e-6;
      capacityOk = groupCapacityIndicative ? null : groupOk && pileOk;
      checks.push({
        id: "capacity",
        title: groupCapacityIndicative ? "Carga × Padm do grupo (indicativo)" : "Carga × Padm do grupo",
        status: groupCapacityIndicative ? "warning" : groupOk ? "ok" : "error",
        message: `N + peso do bloco = ${Ntot.toFixed(1)} kN ${groupOk ? "≤" : ">"} Padm_g = ${groupPadm_kN.toFixed(1)} kN${groupCapacityIndicative ? " — informe η" : ""}`,
        value: Ntot,
        limit: groupPadm_kN,
        unit: "kN",
      });
      checks.push({
        id: "pile_load",
        title: "Estaca mais carregada",
        status: pileOk ? "ok" : "error",
        message: `Nmáx = ${maxPile.toFixed(1)} kN ${pileOk ? "≤" : ">"} Padm = ${input.singlePadm_kN.toFixed(1)} kN`,
        value: maxPile,
        limit: input.singlePadm_kN,
        unit: "kN",
      });
      if (Math.min(...pileLoads_kN) < -1e-6) {
        checks.push({
          id: "tension",
          title: "Estaca tracionada",
          status: "error",
          message: `Nmín = ${Math.min(...pileLoads_kN).toFixed(1)} kN — verificar a estaca à tração ou rever o arranjo.`,
        });
      }
    }
  }

  // Estrutural (cargas de cálculo do pilar; o peso próprio não carrega as bielas).
  let strutTie: BlockDesignResult["strutTie"] = null;
  let punching: BlockDesignResult["punching"] = null;
  let rebar: BlockDesignResult["rebar"] = null;
  const fck = input.fck_MPa ?? 25;
  const fyk = input.fyk_MPa ?? 500;
  const ax = input.columnWidth_m ?? DEFAULT_COLUMN_M;
  const ay = input.columnDepth_m ?? DEFAULT_COLUMN_M;

  if (N != null && N > 0 && pileCount >= 2) {
    const Rd = reactions(N * toDesign, Mx * toDesign, My * toDesign);
    const st = designStrutTie({
      piles: piles.map((p, i) => ({ x_m: p.position.x_m, y_m: p.position.y_m, Rd_kN: Rd[i]! })),
      columnWidth_m: ax,
      columnDepth_m: ay,
      pileDiameter_m: input.diameter_m,
      thickness_m: input.thickness_m,
      capWidth_m: capOutline.width_m,
      capLength_m: capOutline.length_m,
      fck_MPa: fck,
      fyk_MPa: fyk,
    });
    const tieX = pickTieBars(st.AsX_cm2);
    const tieY = pickTieBars(st.AsY_cm2);
    // Malha complementar ≥ As,tirante/5 por direção, distribuída na largura do bloco.
    const meshPerM = Math.max(st.AsX_cm2 / capOutline.length_m, st.AsY_cm2 / capOutline.width_m) / 5;
    const mesh = pickMesh(Math.max(meshPerM, 1e-3));
    strutTie = {
      rigid: st.rigid,
      d_m: st.d_m,
      thetaMin_deg: st.thetaMin_deg,
      thetaMax_deg: st.thetaMax_deg,
      Tx_kN: st.Tx_kN,
      Ty_kN: st.Ty_kN,
      AsX_cm2: st.AsX_cm2,
      AsY_cm2: st.AsY_cm2,
      sigmaColumn_MPa: st.sigmaColumn_MPa,
      sigmaPile_MPa: st.sigmaPile_MPa,
      sigmaLimit_MPa: st.sigmaLimit_MPa,
      ok: st.strutOk,
      message: `Bielas: σpilar=${st.sigmaColumn_MPa.toFixed(1)} MPa, σestaca=${st.sigmaPile_MPa.toFixed(1)} MPa ${st.strutOk ? "≤" : ">"} ${st.sigmaLimit_MPa.toFixed(1)} MPa; θ=${st.thetaMin_deg.toFixed(0)}°–${st.thetaMax_deg.toFixed(0)}°. Tirantes: Tx=${st.Tx_kN.toFixed(0)} kN (${st.AsX_cm2.toFixed(2)} cm²), Ty=${st.Ty_kN.toFixed(0)} kN (${st.AsY_cm2.toFixed(2)} cm²).`,
    };
    rebar = {
      tieX,
      tieY,
      suggestBar_mm: mesh.bar_mm,
      suggestSpacing_cm: mesh.spacing_cm,
      message: `Tirante x: ${tieX.count} φ ${tieX.bar_mm} (${tieX.As_cm2.toFixed(2)} cm²) · tirante y: ${tieY.count} φ ${tieY.bar_mm} (${tieY.As_cm2.toFixed(2)} cm²) · malha φ${mesh.bar_mm} c/${mesh.spacing_cm} cm.`,
    };
    traces.push({
      stepId: "strut_tie",
      title: "Bielas e tirantes (Blévot)",
      formula: "T = Σ Ri·(xi − a/4)/d ; tg θ = d/(r − a/4) ; σ = R/(A·sen²θ) ≤ k·0,85·fcd",
      substitutions: {
        d_m: st.d_m,
        Tx_kN: st.Tx_kN,
        Ty_kN: st.Ty_kN,
        thetaMin_deg: st.thetaMin_deg,
        sigmaColumn_MPa: st.sigmaColumn_MPa,
        sigmaPile_MPa: st.sigmaPile_MPa,
        sigmaLimit_MPa: st.sigmaLimit_MPa,
      },
      result: Math.max(st.AsX_cm2, st.AsY_cm2),
      unit: "cm²",
      reference: "Blévot & Frémy (1967); NBR 6118 22.7",
    });
    checks.push({
      id: "rigid",
      title: "Bloco rígido",
      status: st.rigid ? "ok" : "warning",
      message: st.rigid
        ? `h = ${input.thickness_m.toFixed(2)} m ≥ (a − ap)/3 = ${Math.max(st.rigidLimitX_m, st.rigidLimitY_m).toFixed(2)} m`
        : `h = ${input.thickness_m.toFixed(2)} m < (a − ap)/3 = ${Math.max(st.rigidLimitX_m, st.rigidLimitY_m).toFixed(2)} m — bloco flexível: verificar como placa (punção abaixo)`,
      value: input.thickness_m,
      limit: Math.max(st.rigidLimitX_m, st.rigidLimitY_m),
      unit: "m",
    });
    checks.push({
      id: "strut",
      title: "Tensão nas bielas",
      status: st.strutOk ? "ok" : "error",
      message: strutTie.message,
      value: Math.max(st.sigmaColumn_MPa, st.sigmaPile_MPa),
      limit: st.sigmaLimit_MPa,
      unit: "MPa",
    });
    checks.push({
      id: "strut_angle",
      title: "Inclinação das bielas",
      status: st.angleOk ? "ok" : "warning",
      message: `θ = ${st.thetaMin_deg.toFixed(1)}° a ${st.thetaMax_deg.toFixed(1)}° (Blévot: 45° a 55°)${st.thetaMin_deg < 45 ? " — aumente a altura do bloco" : st.thetaMax_deg > 55 ? " — bloco alto: tirantes ok, confira a ancoragem" : ""}`,
      value: st.thetaMin_deg,
      unit: "°",
    });
    if (!st.rigid) {
      const rhoX = (st.AsX_cm2 * 1e-4) / (capOutline.length_m * st.d_m);
      const rhoY = (st.AsY_cm2 * 1e-4) / (capOutline.width_m * st.d_m);
      const p = checkPileCapPunching({
        Rd_kN: Math.max(...Rd),
        diameter_m: input.diameter_m,
        d_m: st.d_m,
        rho: Math.sqrt(Math.max(rhoX, 1e-6) * Math.max(rhoY, 1e-6)),
        fck_MPa: fck,
      });
      punching = { tauSd_MPa: p.tauSd_MPa, tauRd_MPa: p.tauRd_MPa, ok: p.ok, message: p.message };
      checks.push({
        id: "punching",
        title: "Punção da estaca (bloco flexível)",
        status: p.ok ? "ok" : "error",
        message: p.message,
        value: p.tauSd_MPa,
        limit: p.tauRd_MPa,
        unit: "MPa",
      });
    }
  } else if (N != null && N > 0 && pileCount === 1) {
    warnings.push(
      "Bloco de 1 estaca: a carga passa direto do pilar à estaca; armadura construtiva (estribos horizontais e verticais).",
    );
  }

  return {
    pileCount,
    spacing_m: spacing,
    spacingMin_m: spacingMin,
    piles,
    cap: {
      ...capOutline,
      thickness_m: input.thickness_m,
      area_m2,
    },
    checks,
    groupPadm_kN,
    efficiency,
    efficiencyUserProvided,
    groupCapacityIndicative,
    capacityOk,
    traces,
    warnings,
    strutTie,
    punching,
    rebar,
    pileLoads_kN,
    takeoff: computeBlockTakeoff({
      elementRef: `Bloco de ${pileCount} estaca${pileCount > 1 ? "s" : ""}`,
      pileCount,
      width_m: capOutline.width_m,
      length_m: capOutline.length_m,
      thickness_m: input.thickness_m,
      pileDiameter_m: input.diameter_m,
      concreteGrade: `C${Math.round(fck)}`,
      suggestedBar_mm: rebar?.suggestBar_mm ?? 10,
      suggestedSpacing_cm: rebar?.suggestSpacing_cm ?? 15,
      tieX: rebar?.tieX,
      tieY: rebar?.tieY,
    }),
  };
}

