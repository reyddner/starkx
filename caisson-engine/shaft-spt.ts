/**
 * Atrito lateral do tubulão a partir de SPT — analogia Aoki-Velloso (DEC-22).
 * fs = (α · K · N) / F2  [kPa], com K,α do catálogo de solos e F2 de escavada.
 */

import {
  getSoilType,
  resolveAokiF1F2,
} from "../calculation-engine/catalogs";
import { mPaToKPa } from "../calculation-engine/units";

export interface CaissonSptLayer {
  depth_m: number;
  nspt: number;
  soilTypeId: number;
}

/** pileTypeId 6 = Escavada — analogia moldada in loco para F1/F2 (DEC-22). */
const CAISSON_AOKI_PILE_ANALOGY_ID = 6;

export function shaftFrictionAokiFromSpt(opts: {
  layers: CaissonSptLayer[];
  length_m: number;
  shaftDiameter_m: number;
  fsShaft: number;
}): {
  Rl_ult_kN: number;
  Rl_adm_kN: number;
  avgFs_kPa: number;
  segments: Array<{ depth_m: number; nspt: number; fs_kPa: number; Rl_m_kN: number }>;
} {
  if (!(opts.length_m > 0)) throw new Error("L deve ser > 0 para atrito SPT");
  if (!(opts.shaftDiameter_m > 0)) throw new Error("Ds deve ser > 0");
  if (!(opts.fsShaft > 0)) throw new Error("FS do fuste deve ser > 0");
  if (!opts.layers.length) throw new Error("Camadas SPT obrigatórias no modo spt_aoki");

  const U = Math.PI * opts.shaftDiameter_m;
  const { f2 } = resolveAokiF1F2(
    CAISSON_AOKI_PILE_ANALOGY_ID,
    opts.shaftDiameter_m * 100,
  );
  const byDepth = new Map(opts.layers.map((l) => [Math.round(l.depth_m), l]));
  const Lmax = Math.floor(opts.length_m);
  if (Lmax < 1) {
    return { Rl_ult_kN: 0, Rl_adm_kN: 0, avgFs_kPa: 0, segments: [] };
  }

  const segments: Array<{
    depth_m: number;
    nspt: number;
    fs_kPa: number;
    Rl_m_kN: number;
  }> = [];
  let Rl = 0;
  let sumFs = 0;

  for (let d = 1; d <= Lmax; d++) {
    const layer = byDepth.get(d);
    if (!layer) {
      throw new Error(
        `Modo spt_aoki: falta camada SPT na profundidade ${d} m (necessário 1…${Lmax} m).`,
      );
    }
    const soil = getSoilType(layer.soilTypeId);
    const K = mPaToKPa(soil.aokiK_MPa);
    const alpha = soil.aokiAlpha_percent * 0.01;
    const fs_kPa = (alpha * K * layer.nspt) / f2;
    const deltaL = d === Lmax ? opts.length_m - (Lmax - 1) : 1;
    const Rl_m = fs_kPa * U * deltaL;
    Rl += Rl_m;
    sumFs += fs_kPa * deltaL;
    segments.push({
      depth_m: d,
      nspt: layer.nspt,
      fs_kPa,
      Rl_m_kN: Rl_m,
    });
  }

  return {
    Rl_ult_kN: Rl,
    Rl_adm_kN: Rl / opts.fsShaft,
    avgFs_kPa: sumFs / opts.length_m,
    segments,
  };
}
