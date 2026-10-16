import { getSoilType, resolveAokiF1F2 } from "../catalogs";
import type { DepthMethodValues } from "../types";
import type { SptRow } from "../soil/preprocess-spt";
import type { PileGeometry } from "../piles/geometry";
import { mPaToKPa } from "../units";

export interface AokiOptions {
  fs: number;
  pctTip: number;
  pctShaft: number;
}

/**
 * Aoki & Velloso (1975).
 *
 *   Rp = K · N · Ap / F1          (N do SPT na cota de ponta)
 *   Rl = Σ U · α · K · N · Δz / F2 (N de cada camada do fuste)
 *   Padm = (Rp + Rl) / FS
 */
export function computeAokiVelloso(
  rows: SptRow[],
  geometry: PileGeometry,
  pileTypeId: number,
  opts: AokiOptions,
): DepthMethodValues[] {
  const { f1, f2 } = resolveAokiF1F2(pileTypeId, geometry.diameter_cm);
  const Ap = geometry.area_m2;
  const U = geometry.perimeter_m;
  let rlAcum = 0;
  const out: DepthMethodValues[] = [];

  for (const row of rows) {
    const soil = getSoilType(row.soilTypeId);
    const K = mPaToKPa(soil.aokiK_MPa);
    const alpha = soil.aokiAlpha_percent * 0.01;
    const N = row.nspt;

    const Rp = ((Ap * K * N) / f1) * (opts.pctTip / 100);
    // Fórmula por metro linear; escala pela espessura efetiva do fuste (DEC-57).
    const dh = row.shaftThickness_m ?? row.thickness_m ?? 1;
    const Rl_raw = U * ((alpha * K * N) / f2) * (opts.pctShaft / 100) * dh;
    const Rl_m = row.excludeFromShaftFriction ? 0 : Rl_raw;
    rlAcum += Rl_m;
    const Rult = Rp + rlAcum;
    const Padm = Rult / opts.fs;

    out.push({ Rp_kN: Rp, Rl_m_kN: Rl_m, Rl_acum_kN: rlAcum, Rult_kN: Rult, Padm_kN: Padm });
  }
  return out;
}
