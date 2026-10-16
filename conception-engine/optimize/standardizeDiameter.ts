/**
 * Padroniza diâmetro entre pilares: maioria vence; empate → menor Ø (mais econômico).
 * Não força Ø grande só porque uma minoria precisa.
 */
export function standardizeDiameterCm(diametersCm: number[]): number | null {
  if (diametersCm.length === 0) return null;
  const freq = new Map<number, number>();
  for (const d of diametersCm) {
    if (!(d > 0)) continue;
    freq.set(d, (freq.get(d) ?? 0) + 1);
  }
  if (freq.size === 0) return null;
  let best = diametersCm[0]!;
  let bestCount = 0;
  for (const [d, c] of freq) {
    if (c > bestCount || (c === bestCount && d < best)) {
      best = d;
      bestCount = c;
    }
  }
  return best;
}
