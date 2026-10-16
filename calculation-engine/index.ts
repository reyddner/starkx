import { resolveGeometry } from "./piles/geometry";
import { preprocessSpt } from "./soil/preprocess-spt";
import { computeAokiVelloso } from "./methods/aoki-velloso";
import { computeDecourtQuaresma } from "./methods/decourt-quaresma";
import { computeTeixeira } from "./methods/teixeira";
import {
  decourtAlphaBetaPct,
  getPileType,
  getSoilType,
  resolveAokiF1F2,
} from "./catalogs";
import { kNToTf } from "./units";
import { assessNominalStructuralCapacity } from "./nominal-loads";
import type {
  CalculationInput,
  CalculationResult,
  CalculationStep,
  CalculationTrace,
  MethodAtTip,
  MethodId,
  Verdict,
} from "./types";

function avg(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function markStep(steps: CalculationStep[], id: number, status: CalculationStep["status"]) {
  const s = steps.find((x) => x.id === id);
  if (s) s.status = status;
}

export function calculate(input: CalculationInput): CalculationResult {
  const mode = "engineering" as const;
  const governingRule = input.governingRule ?? "minimum";
  const methods: MethodId[] = input.methods ?? [
    "aoki_velloso",
    "decourt_quaresma",
    "teixeira",
  ];
  if (methods.length === 0) {
    throw new Error("Informe ao menos um método geotécnico (aoki_velloso | decourt_quaresma | teixeira).");
  }
  const warnings: string[] = [];
  const traces: CalculationTrace[] = [];
  const steps: CalculationStep[] = [
    { id: 1, label: "Lendo sondagem", status: "pending" },
    { id: 2, label: "Processando camadas / SPT", status: "pending" },
    { id: 3, label: "Calculando resistência lateral", status: "pending" },
    { id: 4, label: "Calculando resistência de ponta", status: "pending" },
    { id: 5, label: "Verificando fator de segurança", status: "pending" },
    { id: 6, label: "Finalizando resultados", status: "pending" },
  ];

  markStep(steps, 1, "running");
  getPileType(input.pileTypeId);
  for (const layer of input.layers) getSoilType(layer.soilTypeId);

  const pileLength = input.tipDepth_m;
  const pileTopDepth = Math.max(0, input.pileTopDepth_m ?? 0);
  const sptTip = pileTopDepth + pileLength;
  const tip = sptTip;

  if (!Number.isFinite(pileLength) || pileLength < 1) {
    throw new Error("Comprimento da estaca (tipDepth_m) deve ser ≥ 1 m");
  }
  if (!Number.isFinite(pileTopDepth) || pileTopDepth < 0) {
    throw new Error("pileTopDepth_m deve ser ≥ 0");
  }

  {
    const depthSet = input.layers.map((l) => l.depth_m);
    const hasTip = depthSet.some((d) => Math.abs(d - tip) <= 1e-6);
    if (!hasTip) {
      throw new Error(`Falta camada SPT exatamente na cota de apoio (${tip} m).`);
    }
    const hasBelow1 = depthSet.some((d) => Math.abs(d - (tip + 1)) <= 1e-6 || (d > tip && d <= tip + 1.01));
    const hasBelow2 = depthSet.some((d) => d > tip + 1e-6 && d <= tip + 2.01);
    if (!hasBelow1 || !hasBelow2) {
      warnings.push(
        "Recomenda-se informar NSPT até ~2 m abaixo da cota de apoio.",
      );
    }
  }
  markStep(steps, 1, "done");

  markStep(steps, 2, "running");
  const geometry = resolveGeometry({
    pileTypeId: input.pileTypeId,
    diameterCm: input.diameterCm,
    areaCm2: input.areaCm2,
    perimeterCm: input.perimeterCm,
    enlargedBaseVolumeLiters: input.enlargedBaseVolumeLiters,
  });

  traces.push({
    stepId: "pipeline.1",
    methodId: "pipeline",
    title: "Lendo sondagem",
    formula: "validar camadas + tipo de solo",
    substitutions: {
      nLayers: input.layers.length,
      tipDepth_m: pileLength,
      pileTopDepth_m: pileTopDepth,
      sptTipDepth_m: tip,
    },
    result: input.layers.length,
    unit: "camadas",
    reference: "STARKX pipeline",
  });

  traces.push({
    stepId: "geometry.area",
    methodId: "geometry",
    title: "Área da seção",
    formula: "Ap = π·D²/4 (ou manual/Franki)",
    substitutions: { D_cm: input.diameterCm, Ap_m2: geometry.area_m2 },
    result: geometry.area_m2,
    unit: "m²",
    reference: "Geometria da seção",
  });

  const sptRows = preprocessSpt(input.layers, tip, input.diameterCm, {
    pileTopDepth_m: pileTopDepth,
  });
  const excludedShaft = sptRows.filter((r) => r.excludeFromShaftFriction).length;
  if (excludedShaft > 0) {
    warnings.push(
      `${excludedShaft} metro(s) com exclusão de atrito lateral (Rl=0) — DEC-47. Atrito negativo (down-drag) não é calculado.`,
    );
  }
  traces.push({
    stepId: "pipeline.2",
    methodId: "spt",
    title: "Processando camadas / SPT",
    formula: "P,S = N limitado (Décourt 3–15; Teixeira 4–40); Q,T = Np; R,U = N̄L; Rl=0 se excluída",
    substitutions: { rows: sptRows.length, excludedShaftMeters: excludedShaft },
    result: sptRows.length,
    unit: "m",
    reference: "Décourt & Quaresma (1978); Teixeira (1996)",
  });
  markStep(steps, 2, "done");

  const aokiOpts = {
    fs: input.aoki?.fs ?? 2,
    pctTip: input.aoki?.pctTip ?? 100,
    pctShaft: input.aoki?.pctShaft ?? 100,
  };

  // α na ponta: tabela de Décourt (1996) pelo solo da cota de apoio, salvo valor informado.
  // β no fuste: valor informado (único) ou tabela pelo solo de cada camada.
  const tipSoil = sptRows[sptRows.length - 1]!.soilTypeId;
  const decourtAlpha = input.decourt?.alphaPct ?? decourtAlphaBetaPct(tipSoil, input.pileTypeId).alphaPct;
  const decourtBeta = input.decourt?.betaPct ?? null;
  traces.push({
    stepId: "decourt.alpha_beta",
    methodId: "decourt_quaresma",
    title: "α/β Décourt",
    formula: "α: solo da ponta × tipo de estaca; β: informado ou solo de cada camada",
    substitutions: {
      soilTypeId_tip: tipSoil,
      alphaPct: decourtAlpha,
      betaPct: decourtBeta ?? "por camada (tabela)",
    },
    result: `${decourtAlpha}/${decourtBeta ?? "tabela"}`,
    unit: "%",
    reference: "Décourt (1996), DEC-02",
  });

  const teixeiraOpts = {
    fs: input.teixeira?.fs ?? 2,
    pctTip: input.teixeira?.pctTip ?? 100,
    pctShaft: input.teixeira?.pctShaft ?? 100,
  };

  markStep(steps, 3, "running");
  markStep(steps, 4, "running");
  const aoki = methods.includes("aoki_velloso")
    ? computeAokiVelloso(sptRows, geometry, input.pileTypeId, aokiOpts)
    : undefined;
  const decourt = methods.includes("decourt_quaresma")
    ? computeDecourtQuaresma(sptRows, geometry, {
        alphaPct: decourtAlpha,
        betaPct: decourtBeta,
        pileTypeId: input.pileTypeId,
      })
    : undefined;
  const teixeira = methods.includes("teixeira")
    ? computeTeixeira(sptRows, geometry, input.pileTypeId, teixeiraOpts)
    : undefined;
  markStep(steps, 3, "done");
  markStep(steps, 4, "done");

  markStep(steps, 5, "running");
  const profile = sptRows.map((row, i) => {
    const padms: number[] = [];
    const point: CalculationResult["profile"][number] = {
      depth_m: row.depth_m,
      nspt: row.nspt,
      soilTypeId: row.soilTypeId,
      spt: { P: row.P, Q: row.Q, R: row.R, S: row.S, T: row.T, U: row.U },
    };
    if (aoki) {
      point.aoki = aoki[i];
      padms.push(aoki[i]!.Padm_kN);
    }
    if (decourt) {
      point.decourt = decourt[i];
      padms.push(decourt[i]!.Padm_kN);
    }
    if (teixeira) {
      point.teixeira = teixeira[i];
      padms.push(teixeira[i]!.Padm_kN);
    }
    if (padms.length) point.averagePadm_kN = avg(padms);
    return point;
  });

  const tipIdx = sptRows.findIndex((r) => Math.abs(r.depth_m - tip) <= 1e-6);
  if (tipIdx < 0 || tipIdx >= profile.length) {
    throw new Error(`Índice da ponta inválido para sptTipDepth_m=${tip}`);
  }
  const methodResults: MethodAtTip[] = [];
  if (aoki) {
    const { f1, f2 } = resolveAokiF1F2(input.pileTypeId, input.diameterCm);
    const v = aoki[tipIdx]!;
    methodResults.push({
      methodId: "aoki_velloso",
      Rp_kN: v.Rp_kN,
      Rl_acum_kN: v.Rl_acum_kN,
      Rult_kN: v.Rult_kN,
      Padm_kN: v.Padm_kN,
      extras: { F1: f1, F2: f2, FS: aokiOpts.fs, Padm_tf: kNToTf(v.Padm_kN) },
    });
    traces.push({
      stepId: "aoki.at_tip",
      methodId: "aoki_velloso",
      title: "Carga admissível Aoki-Velloso na cota de apoio",
      formula: "Padm = (Rp + ΣRl) / FS",
      substitutions: {
        Rp: v.Rp_kN,
        Rl: v.Rl_acum_kN,
        Rult: v.Rult_kN,
        FS: aokiOpts.fs,
      },
      result: v.Padm_kN,
      unit: "kN",
      reference: "Aoki & Velloso (1975)",
    });
  }
  if (decourt) {
    const v = decourt[tipIdx]!;
    methodResults.push({
      methodId: "decourt_quaresma",
      Rp_kN: v.Rp_kN,
      Rl_acum_kN: v.Rl_acum_kN,
      Rult_kN: v.Rult_kN,
      Padm_kN: v.Padm_kN,
      extras: {
        alphaPct: decourtAlpha,
        betaPct: decourtBeta ?? "tabela",
        Padm_tf: kNToTf(v.Padm_kN),
      },
    });
    traces.push({
      stepId: "decourt.at_tip",
      methodId: "decourt_quaresma",
      title: "Carga admissível Décourt-Quaresma na cota de apoio",
      formula: "Padm = min(R/2, Rl/1.3 + Rp/4)",
      substitutions: {
        Rp: v.Rp_kN,
        Rl: v.Rl_acum_kN,
        Rult: v.Rult_kN,
        crit1: v.Rult_kN / 2,
        crit2: v.Rl_acum_kN / 1.3 + v.Rp_kN / 4,
      },
      result: v.Padm_kN,
      unit: "kN",
      reference: "Décourt & Quaresma (1978)",
    });
  }
  if (teixeira) {
    const v = teixeira[tipIdx]!;
    methodResults.push({
      methodId: "teixeira",
      Rp_kN: v.Rp_kN,
      Rl_acum_kN: v.Rl_acum_kN,
      Rult_kN: v.Rult_kN,
      Padm_kN: v.Padm_kN,
      extras: { FS: teixeiraOpts.fs, Padm_tf: kNToTf(v.Padm_kN) },
    });
    traces.push({
      stepId: "teixeira.at_tip",
      methodId: "teixeira",
      title: "Carga admissível Teixeira na cota de apoio",
      formula: "Padm = (Rp + ΣRl) / FS",
      substitutions: {
        Rp: v.Rp_kN,
        Rl: v.Rl_acum_kN,
        Rult: v.Rult_kN,
        FS: teixeiraOpts.fs,
      },
      result: v.Padm_kN,
      unit: "kN",
      reference: "Teixeira (1996)",
    });
  }

  const padms = methodResults.map((m) => m.Padm_kN);
  const averagePadm_kN = avg(padms);
  const minimumPadm_kN = Math.min(...padms);
  const minMethod = methodResults.reduce((a, b) => (a.Padm_kN <= b.Padm_kN ? a : b));

  let governingPadm_kN: number;
  let governingMethodId: MethodId | "average" | "minimum";
  if (governingRule === "average") {
    governingPadm_kN = averagePadm_kN;
    governingMethodId = "average";
  } else if (governingRule === "user_selected") {
    if (!input.selectedMethod) {
      throw new Error(
        "governingRule=user_selected exige selectedMethod (aoki_velloso | decourt_quaresma | teixeira).",
      );
    }
    const sel = methodResults.find((m) => m.methodId === input.selectedMethod);
    if (!sel) throw new Error("Método selecionado não calculado");
    governingPadm_kN = sel.Padm_kN;
    governingMethodId = sel.methodId;
  } else {
    governingPadm_kN = minimumPadm_kN;
    governingMethodId = minMethod.methodId;
  }

  let verdict: Verdict = "not_applicable";
  if (input.designLoad_kN != null) {
    verdict = governingPadm_kN >= input.designLoad_kN ? "approved" : "not_ok";
  }
  markStep(steps, 5, "done");

  markStep(steps, 6, "running");
  traces.push({
    stepId: "pipeline.6",
    methodId: "compare",
    title: "Finalizando resultados",
    formula: "governante = average | minimum | user_selected",
    substitutions: {
      averagePadm_kN,
      minimumPadm_kN,
      governingPadm_kN,
      governingMethodId,
      verdict,
    },
    result: governingPadm_kN,
    unit: "kN",
    reference: "DEC-03 / DEC-04",
  });
  markStep(steps, 6, "done");

  const nominalStructural = assessNominalStructuralCapacity({
    pileTypeId: input.pileTypeId,
    diameterCm: input.diameterCm,
    governingPadm_kN,
  });
  if (nominalStructural?.exceeded) {
    warnings.push(nominalStructural.message);
  }
  if (nominalStructural) {
    traces.push({
      stepId: "nominal.usual",
      methodId: "compare",
      title: "Carga estrutural usual (DEC-09)",
      formula: "alerta se Padm_governante > Q_nominal(tipo, Ø)",
      substitutions: {
        pileTypeId: input.pileTypeId,
        diameterCm: input.diameterCm,
        nominal_kN: nominalStructural.nominal_kN,
        governingPadm_kN,
        exceeded: nominalStructural.exceeded ? "true" : "false",
      },
      result: nominalStructural.nominal_kN,
      unit: "kN",
      reference: "Tabela de cargas estruturais usuais / DEC-09",
    });
  }

  return {
    mode,
    geometry: {
      area_m2: geometry.area_m2,
      perimeter_m: geometry.perimeter_m,
      diameter_cm: geometry.diameter_cm,
    },
    steps,
    profile,
    atTip: {
      methods: methodResults,
      averagePadm_kN,
      minimumPadm_kN,
      governingPadm_kN,
      governingMethodId,
    },
    verdict,
    traces,
    warnings,
    nominalStructural,
  };
}

export * from "./types";
export * from "./catalogs";
export * from "./units";
export * from "./nominal-loads";
export * from "./pile-catalog";
export * from "./settlement";
export * from "./negative-skin-friction";
export { preprocessSpt } from "./soil/preprocess-spt";

