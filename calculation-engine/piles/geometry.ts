import {
  cm2ToM2,
  diameterCmToAreaM2,
  diameterCmToPerimeterM,
} from "../units";
import { getPileType } from "../catalogs";

export interface GeometryInput {
  pileTypeId: number;
  diameterCm: number;
  /** cm² — obrigatório se metálica */
  areaCm2?: number;
  /** cm — obrigatório se metálica */
  perimeterCm?: number;
  /** litros — obrigatório se Franki */
  enlargedBaseVolumeLiters?: number;
}

export interface PileGeometry {
  area_m2: number;
  perimeter_m: number;
  diameter_m: number;
  diameter_cm: number;
}

/**
 * Franki: raio de esfera equivalente a partir do volume (litros).
 * r = (3·V / 4π)^(1/3), com V em m³.
 */
export function frankiSphereRadius_m(volumeLiters: number): number {
  const v = Math.max(0, volumeLiters) / 1000;
  if (v <= 0) return 0;
  return Math.pow((3 * v) / (4 * Math.PI), 1 / 3);
}

/**
 * Franki: área da base alargada (cm²).
 * Ab = π·r² (cm²).
 */
export function frankiBaseAreaCm2(volumeLiters: number): number {
  const radiusM = frankiSphereRadius_m(volumeLiters);
  return Math.PI * radiusM * radiusM * 10000;
}

export function resolveGeometry(input: GeometryInput): PileGeometry {
  const pile = getPileType(input.pileTypeId);
  if (input.diameterCm > 200) {
    throw new Error("Corrigir Diametro: diâmetro > 200 cm");
  }

  let area_m2: number;
  let perimeter_m: number;

  if (pile.requiresManualArea) {
    if (input.areaCm2 == null || input.perimeterCm == null) {
      throw new Error("Estaca metálica exige área (cm²) e perímetro (cm)");
    }
    area_m2 = cm2ToM2(input.areaCm2);
    perimeter_m = input.perimeterCm * 0.01;
  } else if (pile.requiresEnlargedBase) {
    if (input.enlargedBaseVolumeLiters == null) {
      throw new Error("Franki exige volume da base (litros)");
    }
    area_m2 = cm2ToM2(frankiBaseAreaCm2(input.enlargedBaseVolumeLiters));
    perimeter_m = diameterCmToPerimeterM(input.diameterCm);
  } else {
    area_m2 = diameterCmToAreaM2(input.diameterCm);
    perimeter_m = diameterCmToPerimeterM(input.diameterCm);
  }

  return {
    area_m2,
    perimeter_m,
    diameter_m: input.diameterCm * 0.01,
    diameter_cm: input.diameterCm,
  };
}

/** Helpers usados em testes. */
export { diameterCmToAreaM2, diameterCmToPerimeterM };
