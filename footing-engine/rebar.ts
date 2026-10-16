/**
 * Malha de sapata a partir da armadura calculada (CEB-70) e da mínima.
 * As,mín = 0,15 %·h por metro (NBR 6118 Tabela 19.1, armadura principal de laje/sapata).
 */
export interface FootingRebarSuggestion {
  rhoMin: number;
  As_min_cm2_per_m: number;
  AsB_cm2_per_m: number;
  AsL_cm2_per_m: number;
  suggestBar_mm: number;
  suggestSpacing_cm: number;
  message: string;
}

const BARS_MM = [10, 12.5, 16, 20, 25] as const;

function barArea_cm2(dia_mm: number): number {
  return Math.PI * (dia_mm / 20) ** 2;
}

/** Menor φ com espaçamento entre 10 e 20 cm que fornece As (cm²/m). */
export function pickMesh(As_cm2_per_m: number): { bar_mm: number; spacing_cm: number } {
  for (const dia of BARS_MM) {
    const s = Math.floor((barArea_cm2(dia) / As_cm2_per_m) * 100);
    if (s >= 10) return { bar_mm: dia, spacing_cm: Math.min(20, s) };
  }
  return { bar_mm: 25, spacing_cm: 10 };
}

export function suggestFootingRebar(opts: {
  thickness_m: number;
  AsB_cm2_per_m: number;
  AsL_cm2_per_m: number;
}): FootingRebarSuggestion {
  const rhoMin = 0.0015;
  const As_min_cm2_per_m = rhoMin * 100 * opts.thickness_m * 100;
  const AsB = Math.max(As_min_cm2_per_m, opts.AsB_cm2_per_m);
  const AsL = Math.max(As_min_cm2_per_m, opts.AsL_cm2_per_m);
  const mesh = pickMesh(Math.max(AsB, AsL));
  return {
    rhoMin,
    As_min_cm2_per_m,
    AsB_cm2_per_m: AsB,
    AsL_cm2_per_m: AsL,
    suggestBar_mm: mesh.bar_mm,
    suggestSpacing_cm: mesh.spacing_cm,
    message: `As // B = ${AsB.toFixed(2)} cm²/m; As // L = ${AsL.toFixed(2)} cm²/m (mín. ${As_min_cm2_per_m.toFixed(2)}). Malha: φ${mesh.bar_mm} c/${mesh.spacing_cm} cm nas duas direções.`,
  };
}
