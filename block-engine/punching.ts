/**
 * Punção da estaca no bloco flexível — NBR 6118 item 19.5.
 * (Bloco rígido dispensa: a verificação é a das bielas, item 22.7.)
 *
 * Contorno C (face da estaca, u0 = π·D):       τSd = Rd/(u0·d) ≤ τRd2 = 0,27·αv·fcd
 * Contorno C' (a 2d da face, u1 = π·(D + 4d)): τSd = Rd/(u1·d) ≤ τRd1 = 0,13·(1 + √(20/d))·(100·ρ·fck)^(1/3)
 */
export interface PunchingCheckInput {
  /** Reação de cálculo da estaca mais carregada (kN). */
  Rd_kN: number;
  diameter_m: number;
  /** Altura útil (m). */
  d_m: number;
  /** Taxa de armadura de flexão junto à estaca (ρ = √(ρx·ρy)). */
  rho: number;
  fck_MPa: number;
}

export interface PunchingCheckResult {
  d_m: number;
  u0_m: number;
  u1_m: number;
  tauSd0_MPa: number;
  tauRd2_MPa: number;
  tauSd1_MPa: number;
  tauRd1_MPa: number;
  /** Mantidos para a interface: contorno C' (o determinante usual). */
  tauSd_MPa: number;
  tauRd_MPa: number;
  ok: boolean;
  message: string;
}

export function checkPileCapPunching(input: PunchingCheckInput): PunchingCheckResult {
  const d = input.d_m;
  const fck = input.fck_MPa;
  const fcd = fck / 1.4;
  const u0 = Math.PI * input.diameter_m;
  const u1 = Math.PI * (input.diameter_m + 4 * d);
  const tauSd0 = input.Rd_kN / (u0 * d * 1000);
  const tauRd2 = 0.27 * (1 - fck / 250) * fcd;
  const rho = Math.min(0.02, Math.max(0, input.rho));
  const tauSd1 = input.Rd_kN / (u1 * d * 1000);
  const tauRd1 = 0.13 * (1 + Math.sqrt(20 / (d * 100))) * Math.cbrt(100 * rho * fck);
  const ok = tauSd0 <= tauRd2 + 1e-9 && tauSd1 <= tauRd1 + 1e-9;
  return {
    d_m: d,
    u0_m: u0,
    u1_m: u1,
    tauSd0_MPa: tauSd0,
    tauRd2_MPa: tauRd2,
    tauSd1_MPa: tauSd1,
    tauRd1_MPa: tauRd1,
    tauSd_MPa: tauSd1,
    tauRd_MPa: tauRd1,
    ok,
    message: `Punção (NBR 6118 19.5): C τSd=${tauSd0.toFixed(2)} ${tauSd0 <= tauRd2 ? "≤" : ">"} τRd2=${tauRd2.toFixed(2)} MPa; C' τSd=${tauSd1.toFixed(3)} ${tauSd1 <= tauRd1 ? "≤" : ">"} τRd1=${tauRd1.toFixed(3)} MPa`,
  };
}
