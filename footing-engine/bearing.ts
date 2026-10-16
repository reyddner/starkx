/** Fatores de capacidade de suporte — Vesic (1975), forma fechada. */

export function bearingFactorsVesic(phi_deg: number): {
  Nc: number;
  Nq: number;
  Ngamma: number;
} {
  const phi = (Math.max(0, phi_deg) * Math.PI) / 180;
  if (phi < 1e-9) {
    return { Nc: 5.14, Nq: 1, Ngamma: 0 };
  }
  const Nq = Math.exp(Math.PI * Math.tan(phi)) * Math.tan(Math.PI / 4 + phi / 2) ** 2;
  const Nc = ((Nq - 1) / Math.tan(phi));
  const Ngamma = 2 * (Nq + 1) * Math.tan(phi);
  return { Nc, Nq, Ngamma };
}

export function shapeFactorsVesic(
  B_m: number,
  L_m: number,
  phi_deg: number,
  Nc: number,
  Nq: number,
): { sc: number; sq: number; sgamma: number } {
  const ratio = Math.min(1, B_m / Math.max(L_m, B_m));
  const phi = (Math.max(0, phi_deg) * Math.PI) / 180;
  const sc = Nc > 0 ? 1 + ratio * (Nq / Nc) : 1;
  const sq = 1 + ratio * Math.tan(phi);
  const sgamma = Math.max(0.6, 1 - 0.4 * ratio);
  return { sc, sq, sgamma };
}

/**
 * qult (kPa) — Terzaghi generalizado com fatores Vesic.
 * q = γ·Df (sobrecarga ao nível da base).
 */
export function ultimateBearing_kPa(opts: {
  c_kPa: number;
  phi_deg: number;
  gamma_kN_m3: number;
  Df_m: number;
  B_m: number;
  L_m: number;
}): { qult_kPa: number; Nc: number; Nq: number; Ngamma: number } {
  const { Nc, Nq, Ngamma } = bearingFactorsVesic(opts.phi_deg);
  const { sc, sq, sgamma } = shapeFactorsVesic(
    opts.B_m,
    opts.L_m,
    opts.phi_deg,
    Nc,
    Nq,
  );
  const q = opts.gamma_kN_m3 * opts.Df_m;
  const qult =
    opts.c_kPa * Nc * sc +
    q * Nq * sq +
    0.5 * opts.gamma_kN_m3 * opts.B_m * Ngamma * sgamma;
  return { qult_kPa: qult, Nc, Nq, Ngamma };
}
