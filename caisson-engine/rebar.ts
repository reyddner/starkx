/**
 * Armadura mínima orientativa do tubulão — analogia escavada NBR 6122 (DEC-25).
 * Não é dimensionamento N-M / detalhamento completo.
 */

import { barArea_cm2, LONG_BAR_MM, MIN_BARS_CIRCULAR } from "../structural-engine/catalog";

export interface CaissonRebarSuggestion {
  fck_MPa: number;
  Ac_m2: number;
  rhoMin: number;
  As_min_cm2: number;
  Larm_min_m: number;
  suggestBar_mm: number;
  suggestCount: number;
  As_ef_cm2: number;
  message: string;
}

/** ρmin = 0,4 % (escavada sem fluido — Tab.4); Larm,mín = max(2 m, 0,25·L). */
export function suggestCaissonMinRebar(opts: {
  shaftDiameter_m: number;
  length_m: number;
  fck_MPa?: number;
}): CaissonRebarSuggestion {
  const fck = opts.fck_MPa ?? 25;
  const D = opts.shaftDiameter_m;
  const Ac = (Math.PI * D * D) / 4;
  const rhoMin = 0.004;
  const As_min_cm2 = rhoMin * Ac * 1e4;
  const Larm_min_m = Math.max(2, 0.25 * opts.length_m);

  let count = MIN_BARS_CIRCULAR;
  let bar: number = LONG_BAR_MM[0] ?? 10;
  let As_ef = count * barArea_cm2(bar);
  for (const d of LONG_BAR_MM) {
    for (let n = MIN_BARS_CIRCULAR; n <= 24; n += 2) {
      const as = n * barArea_cm2(d);
      if (as + 1e-9 >= As_min_cm2) {
        count = n;
        bar = d;
        As_ef = as;
        return {
          fck_MPa: fck,
          Ac_m2: Ac,
          rhoMin,
          As_min_cm2,
          Larm_min_m,
          suggestBar_mm: bar,
          suggestCount: count,
          As_ef_cm2: As_ef,
          message: `As,mín ≈ ${As_min_cm2.toFixed(2)} cm² (ρ=${(rhoMin * 100).toFixed(2)} %, analogia escavada). Sugestão: ${count} φ${bar} (${As_ef.toFixed(2)} cm²); Larm,mín ≈ ${Larm_min_m.toFixed(2)} m — conferir NBR 6122/6118.`,
        };
      }
    }
  }

  return {
    fck_MPa: fck,
    Ac_m2: Ac,
    rhoMin,
    As_min_cm2,
    Larm_min_m,
    suggestBar_mm: bar,
    suggestCount: count,
    As_ef_cm2: As_ef,
    message: `As,mín ≈ ${As_min_cm2.toFixed(2)} cm² — revisar bitolas (fora da faixa sugerida automática).`,
  };
}
