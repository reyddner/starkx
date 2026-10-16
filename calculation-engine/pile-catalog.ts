/**
 * Catálogo estruturado de estacas por categoria (DEC-37 W3).
 * Coeficientes Aoki/Décourt/Teixeira permanecem em catalogs.ts (IDs estáveis).
 * Cargas estruturais usuais em nominal-loads.ts.
 */

import { PILE_TYPES, type PileType } from "./catalogs";
import { NOMINAL_LOAD_TABLE } from "./nominal-loads";

export type PileCategoryId = "moldada_in_loco" | "pre_moldada" | "metalica";

export const PILE_CATEGORY_MAP: Record<PileCategoryId, number[]> = {
  moldada_in_loco: [5, 6, 7, 8, 9, 10, 11], // Strauss…Hélice
  pre_moldada: [1, 2, 3], // Vibrada, Centrifugada, Madeira
  metalica: [4],
};

export function categoryOfPileType(pileTypeId: number): PileCategoryId {
  if (PILE_CATEGORY_MAP.moldada_in_loco.includes(pileTypeId)) return "moldada_in_loco";
  if (PILE_CATEGORY_MAP.pre_moldada.includes(pileTypeId)) return "pre_moldada";
  return "metalica";
}

export function pileTypesInCategory(cat: PileCategoryId): PileType[] {
  const ids = PILE_CATEGORY_MAP[cat];
  return PILE_TYPES.filter((p) => ids.includes(p.id));
}

/** Diâmetros com carga estrutural usual cadastrada para o tipo. */
export function diametersForPileType(pileTypeId: number): number[] {
  const set = new Set(
    NOMINAL_LOAD_TABLE.filter((r) => r.pileTypeId === pileTypeId).map((r) => r.diameterCm),
  );
  return [...set].sort((a, b) => a - b);
}

/**
 * Diâmetros comerciais usuais por tipo de estaca (cm).
 * Complementa a tabela de cargas usuais, que cobre só parte das seções de mercado
 * e por isso escondia opções válidas da UI.
 */
const COMMERCIAL_DIAMETERS_CM: Record<number, number[]> = {
  1: [20, 22, 25, 29, 33, 38], // Vibrada de concreto
  2: [20, 23, 26, 33, 38, 42, 50, 60, 70], // Centrifugada
  3: [20, 25, 30, 35, 40], // Madeira
  5: [25, 32, 38, 42, 45], // Strauss
  6: [25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100], // Escavada
  7: [60, 70, 80, 90, 100, 110, 120, 140, 160, 180, 200], // Estacão
  8: [20, 25, 30], // Apiloada
  9: [35, 40, 45, 52, 60], // Franki
  10: [10, 12, 15, 20, 25, 31, 35, 40], // Raiz
  11: [25, 27.5, 30, 35, 40, 50, 60, 70, 80, 90, 100], // Hélice contínua
};

/**
 * Catálogo completo de diâmetros oferecidos na interface: união entre a tabela
 * de cargas usuais e os diâmetros comerciais. Estaca metálica não usa diâmetro
 * (ver `METAL_SECTIONS`).
 */
export function allDiametersForPileType(pileTypeId: number): number[] {
  const set = new Set<number>([
    ...diametersForPileType(pileTypeId),
    ...(COMMERCIAL_DIAMETERS_CM[pileTypeId] ?? []),
  ]);
  return [...set].sort((a, b) => a - b);
}

/** True quando o diâmetro tem carga estrutural usual de referência (DEC-09). */
export function hasNominalReference(pileTypeId: number, diameterCm: number): boolean {
  return NOMINAL_LOAD_TABLE.some(
    (r) => r.pileTypeId === pileTypeId && r.diameterCm === diameterCm,
  );
}

export interface MetalSectionRow {
  id: string;
  label: string;
  nominal_kN: number;
  area_cm2: number;
  perimeter_cm: number | null;
}

/** Perfis metálicos / trilhos (brief §9) — cadastro geométrico; Padm geotécnico usa área/perímetro. */
export const METAL_SECTIONS: MetalSectionRow[] = [
  { id: "TR25", label: "TR 25", nominal_kN: 200, area_cm2: 31.4, perimeter_cm: 38 },
  { id: "TR32", label: "TR 32", nominal_kN: 250, area_cm2: 40.9, perimeter_cm: 41 },
  { id: "TR37", label: "TR 37", nominal_kN: 300, area_cm2: 47.3, perimeter_cm: 44 },
  { id: "TR45", label: "TR 45", nominal_kN: 350, area_cm2: 56.8, perimeter_cm: 49 },
  { id: "TR50", label: "TR 50", nominal_kN: 400, area_cm2: 64.2, perimeter_cm: 52 },
  { id: "2TR32", label: "2 TR 32", nominal_kN: 500, area_cm2: 81.8, perimeter_cm: null },
  { id: "2TR37", label: "2 TR 37", nominal_kN: 600, area_cm2: 94.6, perimeter_cm: null },
  { id: "3TR32", label: "3 TR 32", nominal_kN: 750, area_cm2: 122.7, perimeter_cm: null },
  { id: "3TR37", label: "3 TR 37", nominal_kN: 900, area_cm2: 141.9, perimeter_cm: null },
];
