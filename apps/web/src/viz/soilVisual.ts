/**
 * Cores de solo compartilhadas entre viz 2D (CSS vars) e 3D (hex).
 * Famílias alinhadas a `soilGroup` do calculation-engine (areia ≤5, silte ≤10, argila).
 */

export type SoilVisualFamily = "sand" | "silt" | "clay";

export function soilVisualFamily(soilTypeId: number): SoilVisualFamily {
  if (soilTypeId <= 5) return "sand";
  if (soilTypeId <= 10) return "silt";
  return "clay";
}

/** Preenchimento SVG/CSS — usa tokens do tema. */
export function soilFillCssVar(soilTypeId: number): string {
  const f = soilVisualFamily(soilTypeId);
  if (f === "sand") return "var(--soil-sand)";
  if (f === "silt") return "var(--soil-silt)";
  return "var(--soil-clay)";
}

/** Hex para MeshStandardMaterial (Three não lê CSS vars). */
export function soilColorHex(
  soilTypeId: number,
  theme: "light" | "dark",
): string {
  const f = soilVisualFamily(soilTypeId);
  if (theme === "dark") {
    if (f === "sand") return "#6e5c3c";
    if (f === "silt") return "#525a42";
    return "#5c4a3e";
  }
  // Tons claros / baixa saturação — solo como contexto, não máscara.
  if (f === "sand") return "#f0e6d0";
  if (f === "silt") return "#dde0cc";
  return "#d4c4b6";
}
