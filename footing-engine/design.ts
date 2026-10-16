import { ultimateBearing_kPa } from "./bearing";
import { suggestFootingRebar } from "./rebar";
import type {
  FootingCheck,
  FootingDesignInput,
  FootingDesignResult,
  FootingTrace,
} from "./types";

const DEFAULT_COLUMN_M = 0.3;
const COVER_EFFECT_M = 0.05;

function roundUp(x: number, step: number): number {
  return Math.ceil(x / step - 1e-9) * step;
}

/** Altura de sapata rígida (NBR 6118 22.6.1): h ≥ (B − bp)/3 nas duas direções; mín. 0,40 m. */
export function rigidFootingThickness_m(B: number, L: number, bx: number, by: number): number {
  return roundUp(Math.max(0.4, (B - bx) / 3, (L - by) / 3), 0.05);
}

/** Tensões na base com flexão oblíqua, válidas com toda a base comprimida (núcleo central). */
function basePressures(N: number, Mx: number, My: number, B: number, L: number) {
  const area = B * L;
  const ex = N > 0 ? Math.abs(My) / N : 0;
  const ey = N > 0 ? Math.abs(Mx) / N : 0;
  const kernRatio = (6 * ex) / B + (6 * ey) / L;
  const avg = N / area;
  return { area, ex, ey, kernRatio, avg, max: avg * (1 + kernRatio) };
}

/**
 * Sapata isolada.
 * Geotecnia em serviço: σmáx ≤ σadm com a base toda comprimida (6ex/B + 6ey/L ≤ 1).
 * Estrutural em cálculo (γf): sapata rígida, flexão pelo método CEB-70 e biela no contorno do pilar
 * (NBR 6118 19.5.3.1); se não for rígida, punção no contorno C' a 2d (19.5.3.2).
 */
export function designFooting(input: FootingDesignInput): FootingDesignResult {
  const traces: FootingTrace[] = [];
  const warnings: string[] = [];
  const checks: FootingCheck[] = [];

  if (!(input.Nk_kN > 0)) {
    throw new Error("Nk deve ser > 0");
  }
  const gammaF = input.gammaF ?? 1.4;
  // Geotecnia trabalha com cargas de serviço; estrutural com cargas de cálculo.
  const toService = input.loadIsDesign ? 1 / gammaF : 1;
  const toDesign = input.loadIsDesign ? 1 : gammaF;
  const Nk = input.Nk_kN * toService;
  const Nd = input.Nk_kN * toDesign;
  const Mxk = (input.Mx_kNm ?? 0) * toService;
  const Myk = (input.My_kNm ?? 0) * toService;
  const isRaft = input.elementKind === "raft";

  traces.push({
    stepId: "load",
    title: "Cargas de serviço e de cálculo",
    formula: "Geotecnia: Nk, Mk (serviço). Estrutural: Nd = γf·Nk",
    substitutions: {
      N_informado_kN: input.Nk_kN,
      loadIsDesign: input.loadIsDesign ? "true" : "false",
      gammaF,
      Nk_kN: Nk,
      Nd_kN: Nd,
    },
    result: Nk,
    unit: "kN",
    reference: "NBR 6122 (tensão admissível, serviço) / NBR 6118 (γf = 1,4)",
  });

  const aspect = input.shape === "square" ? 1 : Math.max(1, input.aspectRatio ?? 1.5);
  const gammaC = input.gammaConcrete_kN_m3 ?? 0;
  const bx = input.columnWidth_m ?? DEFAULT_COLUMN_M;
  const by = input.columnDepth_m ?? DEFAULT_COLUMN_M;
  const thicknessFor = (B: number, L: number): number =>
    input.thickness_m ?? (isRaft ? Math.max(0.4, B / 10) : rigidFootingThickness_m(B, L, bx, by));

  // Último qult/fatores calculados (closure → objeto, para o TypeScript não estreitar a null).
  const bearing: { qult: number | null; factors: FootingDesignResult["factors"] } = {
    qult: null,
    factors: null,
  };
  const qadmFor = (B: number, L: number): number => {
    if (input.admMode === "user") {
      if (input.sigmaAdm_kPa == null || !(input.sigmaAdm_kPa > 0)) {
        throw new Error("σadm (kPa) obrigatório no modo user");
      }
      return input.sigmaAdm_kPa;
    }
    const soil = input.soil;
    if (!soil) throw new Error("Parâmetros de solo obrigatórios no modo bearing");
    if (!(soil.fsBearing > 0)) throw new Error("FS de capacidade deve ser > 0");
    const ult = ultimateBearing_kPa({
      c_kPa: soil.c_kPa,
      phi_deg: soil.phi_deg,
      gamma_kN_m3: soil.gamma_kN_m3,
      Df_m: soil.embedment_m,
      B_m: B,
      L_m: L,
    });
    bearing.qult = ult.qult_kPa;
    bearing.factors = { Nc: ult.Nc, Nq: ult.Nq, Ngamma: ult.Ngamma };
    const q = ult.qult_kPa / soil.fsBearing;
    if (!(q > 0)) throw new Error("qadm inválido — revise c, φ, γ, FS");
    return q;
  };

  // 1) Área pela carga vertical de serviço (+ peso próprio).
  let B = 1;
  let L = aspect;
  let qadm = qadmFor(B, L);
  for (let i = 0; i < 30; i++) {
    const W = gammaC * B * L * thicknessFor(B, L);
    const Bn = Math.sqrt((Nk + W) / qadm / aspect);
    const done = Math.abs(Bn - B) < 1e-5;
    B = Bn;
    L = aspect * B;
    qadm = qadmFor(B, L);
    if (done) break;
  }
  // 2) Com momentos: amplia até σmáx ≤ qadm e base toda comprimida.
  for (let i = 0; i < 300; i++) {
    const t = thicknessFor(B, L);
    const p = basePressures(Nk + gammaC * B * L * t, Mxk, Myk, B, L);
    if (p.kernRatio <= 1 + 1e-9 && p.max <= qadm + 1e-6) break;
    B *= 1.01;
    L = aspect * B;
    qadm = qadmFor(B, L);
  }

  const thickness = thicknessFor(B, L);
  const W = gammaC * B * L * thickness;
  const press = basePressures(Nk + W, Mxk, Myk, B, L);

  const sizeSubs: Record<string, number> = { Nk_kN: Nk, W_kN: W, qadm_kPa: qadm, B_m: B, L_m: L };
  if (bearing.factors) {
    sizeSubs.Nc = bearing.factors.Nc;
    sizeSubs.Nq = bearing.factors.Nq;
    sizeSubs.Ngamma = bearing.factors.Ngamma;
  }
  traces.push({
    stepId: input.admMode === "user" ? "size.user" : "bearing",
    title: input.admMode === "user" ? "Área pela tensão admissível" : "Capacidade admissível (Vesic)",
    formula:
      input.admMode === "user"
        ? "A = (Nk + W)/σadm, ampliada até σmáx ≤ σadm e 6ex/B + 6ey/L ≤ 1"
        : "qadm = qult/FS; qult = c·Nc·sc + γ·Df·Nq·sq + 0,5·γ·B·Nγ·sγ",
    substitutions: sizeSubs,
    result: input.admMode === "user" ? B * L : qadm,
    unit: input.admMode === "user" ? "m²" : "kPa",
    reference: input.admMode === "user" ? "NBR 6122" : "Vesic (1975)",
  });
  traces.push({
    stepId: "geometry",
    title: "Geometria adotada",
    formula: "A = B · L",
    substitutions: { B_m: B, L_m: L, t_m: thickness },
    result: B * L,
    unit: "m²",
    reference: "—",
  });

  checks.push({
    id: "pressure_avg",
    title: "Tensão média",
    status: press.avg <= qadm + 1e-6 ? "ok" : "error",
    message: `σméd = ${press.avg.toFixed(1)} kPa ${press.avg <= qadm + 1e-6 ? "≤" : ">"} qadm = ${qadm.toFixed(1)} kPa`,
    value: press.avg,
    limit: qadm,
    unit: "kPa",
  });
  checks.push({
    id: "pressure",
    title: "Tensão máxima",
    status: press.max <= qadm + 1e-6 ? "ok" : "error",
    message: `σmáx = ${press.max.toFixed(1)} kPa ${press.max <= qadm + 1e-6 ? "≤" : ">"} qadm = ${qadm.toFixed(1)} kPa`,
    value: press.max,
    limit: qadm,
    unit: "kPa",
  });
  const kernOk = press.kernRatio <= 1 + 1e-9;
  checks.push({
    id: "kern",
    title: "Base toda comprimida (núcleo central)",
    status: kernOk ? "ok" : "error",
    message: kernOk
      ? `6ex/B + 6ey/L = ${press.kernRatio.toFixed(3)} ≤ 1`
      : `6ex/B + 6ey/L = ${press.kernRatio.toFixed(3)} > 1 — base parcialmente tracionada`,
    value: press.kernRatio,
    limit: 1,
    unit: "—",
  });

  const tRigid = isRaft ? Math.max(0.4, B / 10) : rigidFootingThickness_m(B, L, bx, by);
  const rigid = !isRaft && thickness + 1e-9 >= Math.max((B - bx) / 3, (L - by) / 3);
  checks.push({
    id: "thickness",
    title: isRaft ? "Espessura sugerida" : "Sapata rígida",
    status: thickness + 1e-9 >= tRigid ? "ok" : "warning",
    message: isRaft
      ? `t = ${thickness.toFixed(2)} m (sugerido ${tRigid.toFixed(2)} m)`
      : rigid
        ? `h = ${thickness.toFixed(2)} m ≥ (B − bp)/3 — rígida (NBR 6118 22.6.1)`
        : `h = ${thickness.toFixed(2)} m < ${(Math.max(B - bx, L - by) / 3).toFixed(2)} m — sapata flexível: verificada à punção`,
    value: thickness,
    limit: tRigid,
    unit: "m",
  });

  let rebar: FootingDesignResult["rebar"] = null;
  if (isRaft) {
    warnings.push(
      "Radier: dimensionamento geotécnico (área e tensões). Esforços na placa (flexão, punção nos pilares) exigem modelo de placa sobre base elástica — fora do escopo.",
    );
  } else if (input.fck_MPa != null && input.fck_MPa > 0) {
    const fck = input.fck_MPa;
    const fyk = input.fyk_MPa ?? 500;
    const fcd = fck / 1.4;
    const fyd = fyk / 1.15;
    const d = Math.max(0.1, thickness - COVER_EFFECT_M);
    // Pressão de cálculo do solo, só da carga do pilar (o peso próprio não flete a sapata).
    const pd = basePressures(Nd, Mxk * gammaF, Myk * gammaF, B, L);
    const sigmaD = pd.max;
    // CEB-70: seção S1 a 0,15·bp para dentro da face do pilar.
    const xB = (B - bx) / 2 + 0.15 * bx;
    const xL = (L - by) / 2 + 0.15 * by;
    const MdB = (sigmaD * L * xB * xB) / 2; // flete na direção de B → barras paralelas a B
    const MdL = (sigmaD * B * xL * xL) / 2;
    const AsB_total = (MdB / (0.85 * d * fyd * 1000)) * 1e4;
    const AsL_total = (MdL / (0.85 * d * fyd * 1000)) * 1e4;
    const sug = suggestFootingRebar({
      thickness_m: thickness,
      AsB_cm2_per_m: AsB_total / L,
      AsL_cm2_per_m: AsL_total / B,
    });
    rebar = {
      As_min_cm2_per_m: sug.As_min_cm2_per_m,
      AsB_cm2_per_m: sug.AsB_cm2_per_m,
      AsL_cm2_per_m: sug.AsL_cm2_per_m,
      suggestBar_mm: sug.suggestBar_mm,
      suggestSpacing_cm: sug.suggestSpacing_cm,
      message: sug.message,
    };
    traces.push({
      stepId: "rebar.flexure",
      title: "Flexão (CEB-70)",
      formula: "M1d = σd·L·x²/2, x = (B−bp)/2 + 0,15·bp ; As = M1d/(0,85·d·fyd) ; As ≥ 0,15 %·h",
      substitutions: {
        sigmaD_kPa: sigmaD,
        d_m: d,
        MdB_kNm: MdB,
        MdL_kNm: MdL,
        AsB_cm2_m: sug.AsB_cm2_per_m,
        AsL_cm2_m: sug.AsL_cm2_per_m,
      },
      result: Math.max(sug.AsB_cm2_per_m, sug.AsL_cm2_per_m),
      unit: "cm²/m",
      reference: "CEB-70 / NBR 6118 22.6",
    });
    if (xB > 2 * thickness || xL > 2 * thickness) {
      warnings.push("Balanço maior que 2h: fora do campo do método CEB-70 — sapata muito flexível.");
    }

    // Biela no contorno do pilar (C): τSd ≤ τRd2 = 0,27·αv·fcd
    const u0 = 2 * (bx + by);
    const tauSd0 = Nd / (u0 * d * 1000);
    const tauRd2 = 0.27 * (1 - fck / 250) * fcd;
    const strutOk = tauSd0 <= tauRd2 + 1e-9;
    checks.push({
      id: "strut",
      title: "Biela no contorno do pilar",
      status: strutOk ? "ok" : "error",
      message: `τSd = ${tauSd0.toFixed(2)} MPa ${strutOk ? "≤" : ">"} τRd2 = ${tauRd2.toFixed(2)} MPa (NBR 6118 19.5.3.1)`,
      value: tauSd0,
      limit: tauRd2,
      unit: "MPa",
    });

    if (!rigid) {
      // Punção no contorno C' a 2d, descontando a reação do solo dentro do contorno.
      const u1 = 2 * (bx + by) + 4 * Math.PI * d;
      const areaIn = bx * by + 4 * d * (bx + by) + 4 * Math.PI * d * d;
      const Fsd = Math.max(0, Nd - (Nd / (B * L)) * Math.min(areaIn, B * L));
      const rho = Math.min(0.02, Math.sqrt(sug.AsB_cm2_per_m * sug.AsL_cm2_per_m) / (100 * d * 100));
      const tauRd1 = 0.13 * (1 + Math.sqrt(20 / (d * 100))) * Math.cbrt(100 * rho * fck);
      const tauSd1 = Fsd / (u1 * d * 1000);
      const punchOk = tauSd1 <= tauRd1 + 1e-9;
      checks.push({
        id: "punching",
        title: "Punção (contorno a 2d)",
        status: punchOk ? "ok" : "error",
        message: `τSd = ${tauSd1.toFixed(3)} MPa ${punchOk ? "≤" : ">"} τRd1 = ${tauRd1.toFixed(3)} MPa (NBR 6118 19.5.3.2)`,
        value: tauSd1,
        limit: tauRd1,
        unit: "MPa",
      });
    }
  } else {
    warnings.push("Informe fck para o dimensionamento estrutural da sapata (flexão, biela e punção).");
  }

  return {
    Nk_kN: Nk,
    Nd_kN: Nd,
    B_m: B,
    L_m: L,
    area_m2: B * L,
    thickness_m: thickness,
    thicknessSuggested_m: tRigid,
    qult_kPa: bearing.qult,
    qadm_kPa: qadm,
    sigmaAvg_kPa: press.avg,
    sigmaMax_kPa: press.max,
    ex_m: press.ex,
    ey_m: press.ey,
    factors: bearing.factors,
    checks,
    traces,
    warnings,
    rigid,
    rebar,
  };
}
