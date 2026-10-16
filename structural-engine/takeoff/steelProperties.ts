import type { SteelGrade } from "./types";

/**
 * Massa linear nominal de fios e barras de aço conforme NBR 7480.
 * Massa específica adotada: 7850 kg/m³.
 */
export const STEEL_NOMINAL_WEIGHTS_KG_M: Record<number, number> = {
  4.2: 0.109,
  5.0: 0.154,
  6.3: 0.245,
  8.0: 0.395,
  10.0: 0.617,
  12.5: 0.963,
  16.0: 1.578,
  20.0: 2.466,
  22.0: 2.984,
  25.0: 3.853,
  32.0: 6.313,
};

/**
 * Retorna a massa linear (kg/m) para o diâmetro especificado.
 * Se o diâmetro exato não constar na tabela padrão, calcula via densidade teórica (7850 kg/m³).
 */
export function getSteelWeightPerMeter(diameter_mm: number): number {
  const rounded = Number(diameter_mm.toFixed(1));
  if (STEEL_NOMINAL_WEIGHTS_KG_M[rounded] != null) {
    return STEEL_NOMINAL_WEIGHTS_KG_M[rounded];
  }
  const radius_m = (diameter_mm / 2000);
  const area_m2 = Math.PI * radius_m * radius_m;
  return Number((area_m2 * 7850).toFixed(3));
}

/**
 * Define o tipo de aço padrão para a bitola:
 * Diâmetros <= 5.0 mm são comumente fios CA-60 trefilados.
 * Diâmetros >= 6.3 mm são barras nervuradas CA-50 laminadas a quente.
 */
export function defaultSteelGrade(diameter_mm: number): SteelGrade {
  return diameter_mm <= 5.0 ? "CA-60" : "CA-50";
}
