import { decourtAlphaBetaPct, getSoilType } from "../catalogs";
import type { DepthMethodValues } from "../types";
import {
  decourtShaftMeanN,
  isInDecourtTipWindow,
  shaftSlices,
  type SptRow,
} from "../soil/preprocess-spt";
import type { PileGeometry } from "../piles/geometry";

export interface DecourtOptions {
  /** α (%) da ponta. */
  alphaPct: number;
  /**
   * β (%) do fuste. Número = valor único informado pelo usuário.
   * null = β da tabela de Décourt (1996) pelo solo de cada camada.
   */
  betaPct: number | null;
  pileTypeId: number;
}

/**
 * Décourt & Quaresma (1978), com α e β de Décourt (1996).
 *
 *   Rp = α · C · Np · Ap
 *   Rl = β · 10 · (N̄L/3 + 1) · U · L          [kPa · m² = kN]
 *   Padm = min(Rult/2 ; Rl/1,3 + Rp/4)
 *
 * N̄L é a média do N (3 ≤ N ≤ 15) ao longo de todo o fuste, sem os SPT usados em Np.
 * A soma por camada abaixo reproduz exatamente a fórmula fechada: nas camadas da janela
 * de ponta usa-se N̄L no lugar do N da camada.
 */
export function computeDecourtQuaresma(
  rows: SptRow[],
  geometry: PileGeometry,
  opts: DecourtOptions,
): DepthMethodValues[] {
  const Ap = geometry.area_m2;
  const U = geometry.perimeter_m;
  const out: DepthMethodValues[] = [];
  let prevRl = 0;

  for (let i = 0; i < rows.length; i++) {
    const tip = rows[i]!;
    const NL = decourtShaftMeanN(rows, i);
    let Rl = 0;
    for (const slice of shaftSlices(rows, i)) {
      const n = isInDecourtTipWindow(slice, tip) ? NL : slice.P;
      const betaPct = opts.betaPct ?? decourtAlphaBetaPct(slice.soilTypeId, opts.pileTypeId).betaPct;
      Rl += (betaPct / 100) * 10 * (n / 3 + 1) * U * slice.shaftThickness_m;
    }
    const C = getSoilType(tip.soilTypeId).decourtC_kPa;
    const Rp = (opts.alphaPct / 100) * C * tip.Q * Ap;
    const Rult = Rp + Rl;
    const Padm = Math.min(Rult / 2, Rl / 1.3 + Rp / 4);
    out.push({ Rp_kN: Rp, Rl_m_kN: Rl - prevRl, Rl_acum_kN: Rl, Rult_kN: Rult, Padm_kN: Padm });
    prevRl = Rl;
  }
  return out;
}
