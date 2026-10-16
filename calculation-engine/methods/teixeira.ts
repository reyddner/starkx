import { getPileType, teixeiraAlpha } from "../catalogs";
import type { DepthMethodValues } from "../types";
import { shaftSlices, type SptRow } from "../soil/preprocess-spt";
import type { PileGeometry } from "../piles/geometry";

export interface TeixeiraOptions {
  fs: number;
  pctTip: number;
  pctShaft: number;
}

/**
 * Teixeira (1996).
 *
 *   Rp = α · Np · Ap          Np = média do N entre 4D acima e 1D abaixo da ponta
 *   Rl = β · N̄L · U · L       N̄L = média do N ao longo do fuste
 *   Padm = (Rp + Rl) / FS      com 4 ≤ N ≤ 40
 *
 * Como β é único por tipo de estaca, Σ β·N·U·Δz por camada é igual a β·N̄L·U·L.
 */
export function computeTeixeira(
  rows: SptRow[],
  geometry: PileGeometry,
  pileTypeId: number,
  opts: TeixeiraOptions,
): DepthMethodValues[] {
  const Ap = geometry.area_m2;
  const U = geometry.perimeter_m;
  const beta = getPileType(pileTypeId).teixeiraBeta_kPa;
  const out: DepthMethodValues[] = [];
  let prevRl = 0;

  for (let i = 0; i < rows.length; i++) {
    const tip = rows[i]!;
    const Rl =
      shaftSlices(rows, i).reduce((acc, s) => acc + beta * s.S * U * s.shaftThickness_m, 0) *
      (opts.pctShaft / 100);
    const alpha = teixeiraAlpha(tip.soilTypeId, pileTypeId);
    const Rp = alpha * tip.T * Ap * (opts.pctTip / 100);
    const Rult = Rp + Rl;
    out.push({ Rp_kN: Rp, Rl_m_kN: Rl - prevRl, Rl_acum_kN: Rl, Rult_kN: Rult, Padm_kN: Rult / opts.fs });
    prevRl = Rl;
  }
  return out;
}
