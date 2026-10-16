/**
 * Coeficientes dos métodos semiempíricos.
 * K e α: Aoki & Velloso (1975). C: Décourt & Quaresma (1978). α/β: Décourt (1996).
 * α e β de Teixeira: Teixeira (1996). Referência consolidada: Cintra & Aoki (2010),
 * "Fundações por estacas: projeto geotécnico".
 */

export interface SoilType {
  id: number;
  name: string;
  aokiK_MPa: number;
  aokiAlpha_percent: number;
  decourtC_kPa: number;
}

export const SOIL_TYPES: SoilType[] = [
  { id: 1, name: "Areia", aokiK_MPa: 1.0, aokiAlpha_percent: 1.4, decourtC_kPa: 400 },
  { id: 2, name: "Areia siltosa", aokiK_MPa: 0.8, aokiAlpha_percent: 2.0, decourtC_kPa: 400 },
  { id: 3, name: "Areia siltoargilosa", aokiK_MPa: 0.7, aokiAlpha_percent: 2.4, decourtC_kPa: 400 },
  { id: 4, name: "Areia argilosa", aokiK_MPa: 0.6, aokiAlpha_percent: 3.0, decourtC_kPa: 400 },
  { id: 5, name: "Areia argilossiltosa", aokiK_MPa: 0.5, aokiAlpha_percent: 2.8, decourtC_kPa: 400 },
  { id: 6, name: "Silte", aokiK_MPa: 0.4, aokiAlpha_percent: 3.0, decourtC_kPa: 250 },
  { id: 7, name: "Silte arenoso", aokiK_MPa: 0.55, aokiAlpha_percent: 2.2, decourtC_kPa: 250 },
  { id: 8, name: "Silte arenoargiloso", aokiK_MPa: 0.45, aokiAlpha_percent: 2.8, decourtC_kPa: 200 },
  { id: 9, name: "Silte argiloso", aokiK_MPa: 0.23, aokiAlpha_percent: 3.4, decourtC_kPa: 200 },
  { id: 10, name: "Silte argiloarenoso", aokiK_MPa: 0.25, aokiAlpha_percent: 3.0, decourtC_kPa: 200 },
  { id: 11, name: "Argila", aokiK_MPa: 0.2, aokiAlpha_percent: 6.0, decourtC_kPa: 120 },
  { id: 12, name: "Argila arenosa", aokiK_MPa: 0.35, aokiAlpha_percent: 2.4, decourtC_kPa: 120 },
  { id: 13, name: "Argila arenossiltosa", aokiK_MPa: 0.3, aokiAlpha_percent: 2.8, decourtC_kPa: 120 },
  { id: 14, name: "Argila siltosa", aokiK_MPa: 0.22, aokiAlpha_percent: 4.0, decourtC_kPa: 120 },
  { id: 15, name: "Argila siltoarenosa", aokiK_MPa: 0.33, aokiAlpha_percent: 3.0, decourtC_kPa: 120 },
];

export function getSoilType(id: number): SoilType {
  const s = SOIL_TYPES.find((x) => x.id === id);
  if (!s) throw new Error(`Solo inválido: ${id}`);
  return s;
}

export type SoilGroup = "sand" | "intermediate" | "clay";

export function soilGroup(soilTypeId: number): SoilGroup {
  if (soilTypeId >= 1 && soilTypeId <= 5) return "sand";
  if (soilTypeId >= 6 && soilTypeId <= 10) return "intermediate";
  return "clay";
}

export interface PileType {
  id: number;
  name: string;
  molding: "precast" | "cast_in_place";
  /** F1 fixo; null = usar 1+D_cm/80 */
  aokiF1: number | null;
  aokiF2: number | null;
  teixeiraBeta_kPa: number;
  requiresManualArea: boolean;
  requiresEnlargedBase: boolean;
}

export const PILE_TYPES: PileType[] = [
  { id: 1, name: "Vibrada Concreto", molding: "precast", aokiF1: null, aokiF2: null, teixeiraBeta_kPa: 4, requiresManualArea: false, requiresEnlargedBase: false },
  { id: 2, name: "Centrifugada Concreto", molding: "precast", aokiF1: null, aokiF2: null, teixeiraBeta_kPa: 4, requiresManualArea: false, requiresEnlargedBase: false },
  { id: 3, name: "Madeira", molding: "precast", aokiF1: null, aokiF2: null, teixeiraBeta_kPa: 4, requiresManualArea: false, requiresEnlargedBase: false },
  { id: 4, name: "Metálica", molding: "precast", aokiF1: 1.75, aokiF2: 3.5, teixeiraBeta_kPa: 4, requiresManualArea: true, requiresEnlargedBase: false },
  { id: 5, name: "Strauss", molding: "cast_in_place", aokiF1: 3, aokiF2: 6, teixeiraBeta_kPa: 4, requiresManualArea: false, requiresEnlargedBase: false },
  { id: 6, name: "Escavada", molding: "cast_in_place", aokiF1: 3, aokiF2: 6, teixeiraBeta_kPa: 4, requiresManualArea: false, requiresEnlargedBase: false },
  { id: 7, name: "Estacão", molding: "cast_in_place", aokiF1: 3, aokiF2: 6, teixeiraBeta_kPa: 4, requiresManualArea: false, requiresEnlargedBase: false },
  { id: 8, name: "Apiloada", molding: "cast_in_place", aokiF1: 2.5, aokiF2: 5, teixeiraBeta_kPa: 5, requiresManualArea: false, requiresEnlargedBase: false },
  { id: 9, name: "Franki", molding: "cast_in_place", aokiF1: 2.5, aokiF2: 5, teixeiraBeta_kPa: 5, requiresManualArea: false, requiresEnlargedBase: true },
  { id: 10, name: "Raiz", molding: "cast_in_place", aokiF1: 2, aokiF2: 4, teixeiraBeta_kPa: 6, requiresManualArea: false, requiresEnlargedBase: false },
  { id: 11, name: "Hélice Contínua", molding: "cast_in_place", aokiF1: 2, aokiF2: 4, teixeiraBeta_kPa: 4, requiresManualArea: false, requiresEnlargedBase: false },
];

export function getPileType(id: number): PileType {
  const p = PILE_TYPES.find((x) => x.id === id);
  if (!p) throw new Error(`Tipo de estaca inválido: ${id}`);
  return p;
}

export function resolveAokiF1F2(pileTypeId: number, diameterCm: number): { f1: number; f2: number } {
  const p = getPileType(pileTypeId);
  if (p.aokiF1 == null) {
    const f1 = 1 + diameterCm / 80;
    return { f1, f2: 2 * f1 };
  }
  return { f1: p.aokiF1, f2: p.aokiF2 as number };
}

/**
 * α Teixeira (kPa) por solo × tipo de estaca.
 * Teixeira (1996) tabela 8 solos × 4 grupos (pré-moldada/metálica, Franki, escavada, raiz).
 * Solos intermediários usam a média dos vizinhos da tabela; Strauss, estacão e hélice usam a
 * coluna "escavada"; apiloada usa a coluna Franki.
 */
export const TEIXEIRA_ALPHA: Record<number, number[]> = {
  //                Vib  Cent Mad Met Str Esc Est Api Fra Rai Hel
  1: /* Areia */ [400, 400, 400, 400, 270, 270, 270, 340, 340, 260, 270],
  2: [360, 360, 360, 360, 240, 240, 240, 300, 300, 220, 240],
  3: [330, 330, 330, 330, 220, 220, 220, 270, 270, 205, 220],
  4: [300, 300, 300, 300, 200, 200, 200, 240, 240, 190, 200],
  5: [330, 330, 330, 330, 220, 220, 220, 270, 270, 205, 220],
  6: [160, 160, 160, 160, 110, 110, 110, 120, 120, 110, 110],
  7: [260, 260, 260, 260, 160, 160, 160, 210, 210, 160, 160],
  8: [210, 210, 210, 210, 135, 135, 135, 165, 165, 135, 135],
  9: [160, 160, 160, 160, 110, 110, 110, 120, 120, 110, 110],
  10: [210, 210, 210, 210, 135, 135, 135, 165, 165, 135, 135],
  11: [110, 110, 110, 110, 100, 100, 100, 100, 100, 100, 100],
  12: [210, 210, 210, 210, 130, 130, 130, 160, 160, 140, 130],
  13: [160, 160, 160, 160, 115, 115, 115, 130, 130, 120, 115],
  14: [110, 110, 110, 110, 100, 100, 100, 100, 100, 100, 100],
  15: [160, 160, 160, 160, 115, 115, 115, 130, 130, 120, 115],
};

export function teixeiraAlpha(soilTypeId: number, pileTypeId: number): number {
  const row = TEIXEIRA_ALPHA[soilTypeId];
  if (!row) throw new Error(`α Teixeira: solo ${soilTypeId}`);
  const v = row[pileTypeId - 1];
  if (v == null) throw new Error(`α Teixeira: estaca ${pileTypeId}`);
  return v;
}

/** Fatores α/β de Décourt (1996), em %. DEC-02. */
export function decourtAlphaBetaPct(
  soilTypeId: number,
  pileTypeId: number,
): { alphaPct: number; betaPct: number } {
  // Pré-moldadas / metálica / Franki → 100%
  if ([1, 2, 3, 4, 9].includes(pileTypeId)) {
    return { alphaPct: 100, betaPct: 100 };
  }

  const group = soilGroup(soilTypeId);
  const alphaTable = {
    clay: { excavated: 85, helix: 30, root: 85 },
    intermediate: { excavated: 60, helix: 30, root: 60 },
    sand: { excavated: 50, helix: 30, root: 50 },
  } as const;
  const betaTable = {
    clay: { excavated: 80, helix: 100, root: 150 },
    intermediate: { excavated: 65, helix: 100, root: 150 },
    sand: { excavated: 50, helix: 100, root: 150 },
  } as const;

  let key: "excavated" | "helix" | "root" = "excavated";
  if (pileTypeId === 11) key = "helix";
  else if (pileTypeId === 10) key = "root";
  // 5,6,7,8 → excavated

  return {
    alphaPct: alphaTable[group][key],
    betaPct: betaTable[group][key],
  };
}
