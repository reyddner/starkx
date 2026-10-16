/**
 * Barras do bloco a partir das áreas de aço dos tirantes.
 * Malha complementar: As,malha ≥ As,tirante/5 em cada direção (NBR 6118 22.7.4.1).
 */
const BARS_MM = [10, 12.5, 16, 20, 25] as const;

export function barArea_cm2(dia_mm: number): number {
  return Math.PI * (dia_mm / 20) ** 2;
}

/** Menor combinação n·φ (n ≥ 2) com área ≥ As; prefere menos barras para φ maiores. */
export function pickTieBars(As_cm2: number): { bar_mm: number; count: number; As_cm2: number } {
  let best: { bar_mm: number; count: number; As_cm2: number } | null = null;
  for (const dia of BARS_MM) {
    const count = Math.max(2, Math.ceil(As_cm2 / barArea_cm2(dia) - 1e-9));
    if (count > 16) continue;
    const As = count * barArea_cm2(dia);
    if (!best || As < best.As_cm2 - 1e-9) best = { bar_mm: dia, count, As_cm2: As };
  }
  return best ?? { bar_mm: 25, count: Math.ceil(As_cm2 / barArea_cm2(25)), As_cm2 };
}
