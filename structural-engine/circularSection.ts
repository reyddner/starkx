/**
 * Seção circular de concreto armado — flexo-compressão e cortante pela NBR 6118:2014.
 *
 * Flexo-compressão (item 17.2): diagrama parábola-retângulo com 0,85·fcd, εc2 = 2‰,
 * εcu = 3,5‰ (fck ≤ 50 MPa), aço elastoplástico (Es = 210 GPa, εsu = 10‰) e os três
 * polos de ruína dos domínios de deformação. A resistência é obtida por integração da
 * seção em faixas e das barras uma a uma.
 *
 * Cortante (item 17.4.2.2, Modelo I) sobre o quadrado de mesma área (b = 0,886·D).
 */

const ECU = 0.0035;
const EC2 = 0.002;
const ESU = 0.01;
const ES_MPA = 210000;
const STRIPS = 120;

export interface CircularRcSection {
  diameter_m: number;
  /** Distância do centro da barra longitudinal à face (m). */
  barCenterCover_m: number;
  barCount: number;
  barDiameter_mm: number;
  fcd_MPa: number;
  fyd_MPa: number;
}

export interface SectionForces {
  N_kN: number;
  M_kNm: number;
}

function concreteStress_MPa(eps: number, fcd: number): number {
  if (eps <= 0) return 0;
  if (eps >= EC2) return 0.85 * fcd;
  const r = 1 - eps / EC2;
  return 0.85 * fcd * (1 - r * r);
}

function steelStress_MPa(eps: number, fyd: number): number {
  return Math.max(-fyd, Math.min(fyd, ES_MPA * eps));
}

function barArea_m2(diameter_mm: number): number {
  const r = diameter_mm / 2000;
  return Math.PI * r * r;
}

/** Profundidades (a partir da fibra mais comprimida) das barras para um giro θ0. */
function barDepths_m(sec: CircularRcSection, theta0: number): number[] {
  const R = sec.diameter_m / 2;
  const rs = R - sec.barCenterCover_m;
  return Array.from({ length: sec.barCount }, (_, i) => {
    const th = theta0 + (2 * Math.PI * i) / sec.barCount;
    return R - rs * Math.cos(th);
  });
}

/**
 * Esforços resistentes (N compressão +, M em relação ao centro) para a linha neutra x,
 * medida a partir da fibra mais comprimida. x pode ser negativa (seção toda tracionada)
 * ou maior que D (seção toda comprimida).
 */
export function sectionForcesAtX(sec: CircularRcSection, x: number, theta0 = 0): SectionForces {
  const D = sec.diameter_m;
  const R = D / 2;
  const depths = barDepths_m(sec, theta0);
  const dmax = Math.max(...depths);
  const x23 = (ECU / (ECU + ESU)) * dmax;
  const yC = (1 - EC2 / ECU) * D;

  const strainAt = (y: number): number => {
    if (x <= x23) return (ESU * (x - y)) / (dmax - x);
    if (x <= D) return (ECU * (x - y)) / x;
    return (EC2 * (x - y)) / (x - yC);
  };

  let N = 0;
  let M = 0;
  const dy = D / STRIPS;
  for (let k = 0; k < STRIPS; k++) {
    const y = (k + 0.5) * dy;
    const half = Math.sqrt(Math.max(0, R * R - (y - R) * (y - R)));
    const F = concreteStress_MPa(strainAt(y), sec.fcd_MPa) * 2 * half * dy * 1000;
    N += F;
    M += F * (R - y);
  }
  const As1 = barArea_m2(sec.barDiameter_mm);
  for (const y of depths) {
    const eps = strainAt(y);
    // desconta o concreto deslocado pela barra
    const F = (steelStress_MPa(eps, sec.fyd_MPa) - concreteStress_MPa(eps, sec.fcd_MPa)) * As1 * 1000;
    N += F;
    M += F * (R - y);
  }
  return { N_kN: N, M_kNm: M };
}

/** Normal resistente máximo (compressão uniforme a 2‰). */
export function maxAxialResistance_kN(sec: CircularRcSection): number {
  return sectionForcesAtX(sec, 1e3 * sec.diameter_m).N_kN;
}

/**
 * Momento resistente MRd para o normal Nd (kN), no giro mais desfavorável das barras.
 * Retorna null se Nd excede a resistência axial da seção.
 */
export function momentResistance_kNm(sec: CircularRcSection, Nd_kN: number): number | null {
  const D = sec.diameter_m;
  let best: number | null = null;
  for (const theta0 of [0, Math.PI / sec.barCount]) {
    let lo = -10 * D;
    let hi = 1e3 * D;
    if (Nd_kN > sectionForcesAtX(sec, hi, theta0).N_kN + 1e-6) return null;
    if (Nd_kN < sectionForcesAtX(sec, lo, theta0).N_kN - 1e-6) return null;
    for (let it = 0; it < 80; it++) {
      const mid = (lo + hi) / 2;
      if (sectionForcesAtX(sec, mid, theta0).N_kN < Nd_kN) lo = mid;
      else hi = mid;
    }
    const M = Math.abs(sectionForcesAtX(sec, (lo + hi) / 2, theta0).M_kNm);
    best = best == null ? M : Math.min(best, M);
  }
  return best;
}

/** Momento mínimo de 1ª ordem, NBR 6118 item 11.3.3.4.3: M1d,mín = Nd·(0,015 + 0,03·h). */
export function minimumFirstOrderMoment_kNm(Nd_kN: number, diameter_m: number): number {
  return Math.max(0, Nd_kN) * (0.015 + 0.03 * diameter_m);
}

export interface ShearDesignInput {
  diameter_m: number;
  cover_m: number;
  stirrupDiameter_mm: number;
  longDiameter_mm: number;
  fck_MPa: number;
  /** γc da seção (o mesmo usado em fcd). */
  gammaC: number;
  fywd_MPa: number;
  Vsd_kN: number;
}

export interface ShearDesignResult {
  bw_m: number;
  d_m: number;
  VRd2_kN: number;
  Vc_kN: number;
  /** Asw/s necessária (cm²/m); 0 se o concreto resiste sozinho. */
  AswPerS_cm2_m: number;
  /** Espaçamento máximo pelo cálculo e pelas regras do item 18.3.3.2 (m). */
  maxSpacing_m: number;
  crushingOk: boolean;
}

/**
 * Cortante pelo Modelo I (θ = 45°), sobre o quadrado equivalente de lado 0,886·D.
 * Vc = Vc0 = 0,6·fctd·bw·d (sem o acréscimo da flexo-compressão, a favor da segurança).
 */
export function designCircularShear(input: ShearDesignInput): ShearDesignResult {
  const b = Math.sqrt(Math.PI / 4) * input.diameter_m;
  const d = Math.max(0.05, b - input.cover_m - input.stirrupDiameter_mm / 1000 - input.longDiameter_mm / 2000);
  const fcd = input.fck_MPa / input.gammaC;
  const fctd = (0.21 * Math.pow(input.fck_MPa, 2 / 3)) / input.gammaC;
  const alphaV2 = 1 - input.fck_MPa / 250;
  const VRd2 = 0.27 * alphaV2 * fcd * b * d * 1000;
  const Vc = 0.6 * fctd * b * d * 1000;
  const Vsw = Math.max(0, input.Vsd_kN - Vc);
  const AswPerS_m2_m = Vsw / (0.9 * d * input.fywd_MPa * 1000);
  const legs = 2;
  const Asw_m2 = legs * barArea_m2(input.stirrupDiameter_mm);
  const sCalc = AswPerS_m2_m > 0 ? Asw_m2 / AswPerS_m2_m : Infinity;
  const sRule = input.Vsd_kN <= 0.67 * VRd2 ? Math.min(0.6 * d, 0.3) : Math.min(0.3 * d, 0.2);
  return {
    bw_m: b,
    d_m: d,
    VRd2_kN: VRd2,
    Vc_kN: Vc,
    AswPerS_cm2_m: AswPerS_m2_m * 1e4,
    maxSpacing_m: Vsw > 0 ? Math.min(sCalc, sRule) : Infinity,
    crushingOk: input.Vsd_kN <= VRd2 + 1e-6,
  };
}
