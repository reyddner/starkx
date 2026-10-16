import { ultimateBearing_kPa } from "../footing-engine/bearing";
import { suggestCaissonMinRebar } from "./rebar";
import { shaftFrictionAokiFromSpt } from "./shaft-spt";
import type {
  CaissonCheck,
  CaissonDesignInput,
  CaissonDesignResult,
  CaissonShaftMode,
  CaissonTrace,
} from "./types";

/**
 * Capacidade geotécnica de tubulão (ponta ± fuste).
 * Fuste: fs informado ou α·NSPT (Aoki) — DEC-22.
 */
export function designCaisson(input: CaissonDesignInput): CaissonDesignResult {
  const traces: CaissonTrace[] = [];
  const warnings: string[] = [];
  const checks: CaissonCheck[] = [];

  if (!(input.Nk_kN > 0)) throw new Error("Nk deve ser > 0");
  if (!(input.shaftDiameter_m > 0)) throw new Error("Diâmetro do fuste deve ser > 0");
  if (!(input.length_m > 0)) throw new Error("Comprimento L deve ser > 0");

  const Ds = input.shaftDiameter_m;
  const Db =
    input.baseDiameter_m != null && input.baseDiameter_m > 0
      ? input.baseDiameter_m
      : Ds;
  if (Db + 1e-9 < Ds) {
    throw new Error("Diâmetro da base deve ser ≥ diâmetro do fuste");
  }

  // Capacidade admissível compara com carga de serviço; o fuste de concreto, com a de cálculo.
  const gammaF = input.gammaF ?? 1.4;
  const Nk = input.loadIsDesign ? input.Nk_kN / gammaF : input.Nk_kN;
  const Nd = input.loadIsDesign ? input.Nk_kN : input.Nk_kN * gammaF;
  traces.push({
    stepId: "load",
    title: "Cargas de serviço e de cálculo",
    formula: "Nk (serviço) ; Nd = γf · Nk",
    substitutions: {
      N_informado_kN: input.Nk_kN,
      gammaF,
      loadIsDesign: input.loadIsDesign ? "true" : "false",
      Nk_kN: Nk,
      Nd_kN: Nd,
    },
    result: Nk,
    unit: "kN",
    reference: "NBR 6122 / NBR 6118",
  });

  // Base alargada: tronco de cone a 60° com a horizontal (prática usual de tubulões).
  const bellHeight_m = ((Db - Ds) / 2) * Math.tan(Math.PI / 3);
  // Sem atrito no trecho do alargamento.
  const frictionLength_m = Math.max(0, input.length_m - bellHeight_m);

  const Ap = (Math.PI * Db * Db) / 4;
  const U = Math.PI * Ds;
  traces.push({
    stepId: "geometry",
    title: "Geometria",
    formula: "Ap = π·Db²/4; U = π·Ds",
    substitutions: { Ds_m: Ds, Db_m: Db, L_m: input.length_m },
    result: Ap,
    unit: "m²",
    reference: "docs/METHODS.md",
  });

  let qult: number | null = null;
  let qadm = 0;
  let factors: CaissonDesignResult["factors"] = null;
  let Rp_adm = 0;

  if (input.admMode === "user") {
    if (input.sigmaAdm_kPa == null || !(input.sigmaAdm_kPa > 0)) {
      throw new Error("σadm (kPa) obrigatório no modo user");
    }
    qadm = input.sigmaAdm_kPa;
    Rp_adm = qadm * Ap;
    traces.push({
      stepId: "tip.user",
      title: "Ponta — σadm informado",
      formula: "Rp_adm = σadm · Ap",
      substitutions: { sigmaAdm_kPa: qadm, Ap_m2: Ap },
      result: Rp_adm,
      unit: "kN",
      reference: "docs/METHODS.md",
    });
  } else {
    const soil = input.soil;
    if (!soil) throw new Error("Parâmetros de solo obrigatórios no modo bearing");
    if (!(soil.fsTip > 0)) throw new Error("FS da ponta deve ser > 0");
    const ult = ultimateBearing_kPa({
      c_kPa: soil.c_kPa,
      phi_deg: soil.phi_deg,
      gamma_kN_m3: soil.gamma_kN_m3,
      Df_m: input.length_m,
      B_m: Db,
      L_m: Db,
    });
    qult = ult.qult_kPa;
    factors = { Nc: ult.Nc, Nq: ult.Nq, Ngamma: ult.Ngamma };
    qadm = qult / soil.fsTip;
    Rp_adm = qadm * Ap;
    traces.push({
      stepId: "tip.bearing",
      title: "Ponta — Vesic circular",
      formula: "qadm = qult/FS_tip; Rp_adm = qadm · Ap",
      substitutions: {
        c_kPa: soil.c_kPa,
        phi_deg: soil.phi_deg,
        gamma: soil.gamma_kN_m3,
        Df_m: input.length_m,
        FS_tip: soil.fsTip,
        Db_m: Db,
        Nc: ult.Nc,
        Nq: ult.Nq,
        Ngamma: ult.Ngamma,
      },
      result: Rp_adm,
      unit: "kN",
      reference: "Vesic (1975)",
    });
  }

  const shaftMode: CaissonShaftMode = input.shaftMode ?? "user";
  const shaftFS = input.shaftFS ?? input.fsShaft ?? 1.5;
  if (!(shaftFS > 0)) throw new Error("FS do fuste (shaftFS) deve ser > 0");

  let Rl_adm = 0;
  let avgFsShaft_kPa: number | null = null;

  if (shaftMode === "spt_aoki") {
    const spt = shaftFrictionAokiFromSpt({
      layers: input.sptLayers ?? [],
      length_m: frictionLength_m,
      shaftDiameter_m: Ds,
      fsShaft: shaftFS,
    });
    Rl_adm = spt.Rl_adm_kN;
    avgFsShaft_kPa = spt.avgFs_kPa;
    traces.push({
      stepId: "shaft.spt_aoki",
      title: "Fuste — α·NSPT (Aoki)",
      formula: "fs=(α·K·N)/F2; Rl_adm = Σ(fs·U·ΔL)/FS_shaft",
      substitutions: {
        F2_escavada: "catálogo",
        nSegments: spt.segments.length,
        avgFs_kPa: spt.avgFs_kPa,
        Rl_ult_kN: spt.Rl_ult_kN,
        shaftFS,
      },
      result: Rl_adm,
      unit: "kN",
      reference: "DEC-22 / Aoki-Velloso (analogia escavada)",
    });
    warnings.push(
      "Fuste spt_aoki: F1/F2 e α,K do catálogo Aoki com analogia à estaca escavada (DEC-22).",
    );
  } else {
    const unitFriction = Math.max(
      0,
      input.unitFriction_kPa ?? input.fsShaft_kPa ?? 0,
    );
    avgFsShaft_kPa = unitFriction;
    Rl_adm = (unitFriction * U * frictionLength_m) / shaftFS;
    traces.push({
      stepId: "shaft.user",
      title: "Fuste — atrito informado",
      formula: "Rl_adm = (unitFriction · U · (L − H)) / shaftFS",
      substitutions: {
        unitFriction_kPa: unitFriction,
        U_m: U,
        L_atrito_m: frictionLength_m,
        shaftFS,
      },
      result: Rl_adm,
      unit: "kN",
      reference: "docs/METHODS.md",
    });
    if (unitFriction <= 0) {
      warnings.push("Atrito lateral unitário = 0 — capacidade apenas pela ponta.");
    }
  }

  const Padm = Rp_adm + Rl_adm;
  traces.push({
    stepId: "padm",
    title: "Capacidade admissível",
    formula: "Padm = Rp_adm + Rl_adm",
    substitutions: { Rp_adm_kN: Rp_adm, Rl_adm_kN: Rl_adm },
    result: Padm,
    unit: "kN",
    reference: "docs/METHODS.md",
  });

  const capacityOk = Padm + 1e-6 >= Nk;
  checks.push({
    id: "capacity",
    title: "Capacidade × carga de serviço",
    status: capacityOk ? "ok" : "error",
    message: capacityOk
      ? `Padm = ${Padm.toFixed(1)} kN ≥ Nk = ${Nk.toFixed(1)} kN`
      : `Padm = ${Padm.toFixed(1)} kN < Nk = ${Nk.toFixed(1)} kN`,
    value: Padm,
    limit: Nk,
    unit: "kN",
  });

  // Fuste de concreto simples à compressão: Nd ≤ 0,85·fcd·As, fcd pela NBR 6122 Tab. 4
  // (analogia com escavada sem fluido: fck ≤ 25 MPa, γc = 3,1).
  const fckShaft = Math.min(input.fck_MPa ?? 25, 25);
  const fcdShaft = fckShaft / 3.1;
  const sigmaShaft = Nd / (((Math.PI * Ds * Ds) / 4) * 1000);
  const shaftOk = sigmaShaft <= 0.85 * fcdShaft + 1e-9;
  checks.push({
    id: "shaft_concrete",
    title: "Concreto do fuste",
    status: shaftOk ? "ok" : "error",
    message: `σd = ${sigmaShaft.toFixed(2)} MPa ${shaftOk ? "≤" : ">"} 0,85·fcd = ${(0.85 * fcdShaft).toFixed(2)} MPa (fck ${fckShaft} MPa, γc 3,1)`,
    value: sigmaShaft,
    limit: 0.85 * fcdShaft,
    unit: "MPa",
  });

  if (Db - Ds > 1e-6) {
    const bellOk = bellHeight_m <= 1.8 + 1e-9;
    checks.push({
      id: "bell",
      title: "Altura da base alargada",
      status: bellOk ? "ok" : "warning",
      message: `H = (Db − Ds)/2 · tg 60° = ${bellHeight_m.toFixed(2)} m ${bellOk ? "≤" : ">"} 1,80 m`,
      value: bellHeight_m,
      limit: 1.8,
      unit: "m",
    });
    warnings.push(
      `Base alargada Db = ${Db.toFixed(2)} m: atrito desprezado nos ${bellHeight_m.toFixed(2)} m do alargamento.`,
    );
  }
  const ok = capacityOk && shaftOk;

  let rebar: CaissonDesignResult["rebar"] = null;
  if (input.fck_MPa != null && input.fck_MPa > 0) {
    const sug = suggestCaissonMinRebar({
      shaftDiameter_m: Ds,
      length_m: input.length_m,
      fck_MPa: input.fck_MPa,
    });
    rebar = {
      As_min_cm2: sug.As_min_cm2,
      Larm_min_m: sug.Larm_min_m,
      suggestBar_mm: sug.suggestBar_mm,
      suggestCount: sug.suggestCount,
      message: sug.message,
    };
    traces.push({
      stepId: "rebar.min",
      title: "Armadura mínima orientativa (fuste)",
      formula: "As,mín = ρmin·Ac; ρmin=0,4 % (analogia escavada)",
      substitutions: {
        fck: sug.fck_MPa,
        Ac_m2: sug.Ac_m2,
        rhoMin: sug.rhoMin,
        As_min_cm2: sug.As_min_cm2,
        Larm_min_m: sug.Larm_min_m,
      },
      result: sug.As_min_cm2,
      unit: "cm²",
      reference: "DEC-25 / NBR 6122 Tab.4 (orientação)",
    });
    warnings.push(
      "As,mín do tubulão é orientação (analogia escavada) — não fecha N-M/detalhamento.",
    );
  } else {
    warnings.push(
      "Tubulão geotécnico — informe fck na armadura para As,mín orientativa do fuste.",
    );
  }

  return {
    Nd_kN: Nd,
    shaftDiameter_m: Ds,
    baseDiameter_m: Db,
    length_m: input.length_m,
    Ap_m2: Ap,
    U_m: U,
    Rp_adm_kN: Rp_adm,
    Rl_adm_kN: Rl_adm,
    Padm_kN: Padm,
    qult_kPa: qult,
    qadm_kPa: qadm,
    factors,
    shaftMode,
    avgFsShaft_kPa,
    verdict: ok ? "approved" : "not_ok",
    checks,
    traces,
    warnings,
    rebar,
  };
}
