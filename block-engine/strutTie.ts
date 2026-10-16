/**
 * Bloco rígido sobre estacas — método das bielas (Blévot & Frémy, 1967), generalizado.
 *
 * Tirante na direção x (equilíbrio de momentos no ponto a ax/4 do eixo do pilar):
 *   Tx = Σ_{xi > 0} Ri · (xi − ax/4) / d          (idem em y)
 * Para 2 estacas: T = Nd·(2e − a)/(8d), a expressão clássica de Blévot.
 *
 * Bielas: tg θi = d / (ri − ar/4), com 45° ≤ θ ≤ 55° (campo dos ensaios de Blévot).
 * Tensões nas bielas, junto ao pilar e junto à estaca:
 *   σc,pilar = Nd / (Ap · sen²θ) ;  σc,estaca = Ri / (Aest · sen²θ)  ≤  k · 0,85 · fcd
 *   k = 1,4 (2 estacas), 1,75 (3), 2,1 (4 ou mais).
 * Bloco rígido: h ≥ (a − ap)/3 nas duas direções (NBR 6118 22.7.1).
 */

export interface StrutTiePile {
  x_m: number;
  y_m: number;
  /** Reação de cálculo da estaca (kN). */
  Rd_kN: number;
}

export interface StrutTieInput {
  piles: StrutTiePile[];
  columnWidth_m: number;
  columnDepth_m: number;
  pileDiameter_m: number;
  thickness_m: number;
  /** Distância do CG do tirante à face inferior (m); default 0,10. */
  tieCover_m?: number;
  capWidth_m: number;
  capLength_m: number;
  fck_MPa: number;
  fyk_MPa: number;
}

export interface StrutTieResult {
  d_m: number;
  rigid: boolean;
  rigidLimitX_m: number;
  rigidLimitY_m: number;
  thetaMin_deg: number;
  thetaMax_deg: number;
  Tx_kN: number;
  Ty_kN: number;
  AsX_cm2: number;
  AsY_cm2: number;
  sigmaColumn_MPa: number;
  sigmaPile_MPa: number;
  sigmaLimit_MPa: number;
  strutOk: boolean;
  angleOk: boolean;
}

function tieForce(piles: StrutTiePile[], axis: "x" | "y", a_m: number, d: number): number {
  let pos = 0;
  let neg = 0;
  for (const p of piles) {
    const c = axis === "x" ? p.x_m : p.y_m;
    const arm = Math.abs(c) - a_m / 4;
    if (arm <= 1e-9) continue;
    if (c > 0) pos += (p.Rd_kN * arm) / d;
    else neg += (p.Rd_kN * arm) / d;
  }
  return Math.max(pos, neg);
}

export function designStrutTie(input: StrutTieInput): StrutTieResult {
  const ax = input.columnWidth_m;
  const ay = input.columnDepth_m;
  const d = Math.max(0.1, input.thickness_m - (input.tieCover_m ?? 0.1));
  const fcd = input.fck_MPa / 1.4;
  const fyd = input.fyk_MPa / 1.15;
  const n = input.piles.length;
  const Nd = input.piles.reduce((a, p) => a + p.Rd_kN, 0);

  const Tx = tieForce(input.piles, "x", ax, d);
  const Ty = tieForce(input.piles, "y", ay, d);

  const thetas: number[] = [];
  let sigmaPile = 0;
  const Apile = (Math.PI * input.pileDiameter_m ** 2) / 4;
  for (const p of input.piles) {
    const r = Math.hypot(p.x_m, p.y_m);
    if (r < 1e-9) continue;
    const ar = (Math.abs(p.x_m) / r) * ax + (Math.abs(p.y_m) / r) * ay;
    const horiz = r - ar / 4;
    if (horiz <= 1e-9) continue;
    const theta = Math.atan(d / horiz);
    thetas.push(theta);
    sigmaPile = Math.max(sigmaPile, p.Rd_kN / (Apile * Math.sin(theta) ** 2 * 1000));
  }
  const thetaMin = thetas.length ? Math.min(...thetas) : Math.PI / 2;
  const thetaMax = thetas.length ? Math.max(...thetas) : Math.PI / 2;
  const sigmaColumn = Nd / (ax * ay * Math.sin(thetaMin) ** 2 * 1000);
  const k = n <= 2 ? 1.4 : n === 3 ? 1.75 : 2.1;
  const sigmaLimit = k * 0.85 * fcd;

  const rigidLimitX = (input.capWidth_m - ax) / 3;
  const rigidLimitY = (input.capLength_m - ay) / 3;
  const thetaMinDeg = (thetaMin * 180) / Math.PI;
  const thetaMaxDeg = (thetaMax * 180) / Math.PI;

  return {
    d_m: d,
    rigid: input.thickness_m + 1e-9 >= Math.max(rigidLimitX, rigidLimitY),
    rigidLimitX_m: rigidLimitX,
    rigidLimitY_m: rigidLimitY,
    thetaMin_deg: thetaMinDeg,
    thetaMax_deg: thetaMaxDeg,
    Tx_kN: Tx,
    Ty_kN: Ty,
    AsX_cm2: (Tx / (fyd * 1000)) * 1e4,
    AsY_cm2: (Ty / (fyd * 1000)) * 1e4,
    sigmaColumn_MPa: sigmaColumn,
    sigmaPile_MPa: sigmaPile,
    sigmaLimit_MPa: sigmaLimit,
    strutOk: sigmaColumn <= sigmaLimit + 1e-9 && sigmaPile <= sigmaLimit + 1e-9,
    angleOk: thetaMinDeg >= 45 - 1e-6 && thetaMaxDeg <= 55 + 1e-6,
  };
}
