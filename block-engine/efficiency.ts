/**
 * Eficiência de grupo — fórmula de Converse-Labarre.
 *
 *   η = 1 − θ · [ (n − 1)·m + (m − 1)·n ] / (90 · m · n),   θ = arctg(D/s) em graus
 *
 * m = linhas, n = colunas, s = espaçamento centro a centro. Aplicável a estacas de atrito
 * em argila; em areias a eficiência costuma ser ≥ 1 e o valor fica a favor da segurança.
 * Referência: Velloso & Lopes, "Fundações", vol. 2.
 */
export function suggestEfficiencyConverseLabarre(opts: {
  rows: number;
  cols: number;
  diameter_m: number;
  spacing_m: number;
}): { eta: number; theta_deg: number; formula: string } {
  const m = Math.floor(opts.rows);
  const n = Math.floor(opts.cols);
  if (m < 1 || n < 1) {
    throw new Error("Linhas e colunas devem ser ≥ 1");
  }
  if (!(opts.diameter_m > 0)) throw new Error("Diâmetro deve ser > 0");
  if (!(opts.spacing_m > 0)) throw new Error("Espaçamento deve ser > 0");
  if (m === 1 && n === 1) {
    return { eta: 1, theta_deg: 0, formula: "η = 1 (estaca isolada)" };
  }
  const theta_deg = (Math.atan(opts.diameter_m / opts.spacing_m) * 180) / Math.PI;
  const raw = 1 - (theta_deg * ((n - 1) * m + (m - 1) * n)) / (90 * m * n);
  return {
    eta: Math.max(0.01, Math.min(1, raw)),
    theta_deg,
    formula: "η = 1 − θ·[(n−1)·m + (m−1)·n]/(90·m·n); θ = arctg(D/s)",
  };
}
