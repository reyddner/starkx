/** Conversões de unidade — explícitas e testáveis. */

export type UnitSystemId = "SI";

/** Motor e armazenamento internos: sempre SI. */
export const INTERNAL_UNIT_SYSTEM: UnitSystemId = "SI";

export const UNIT_LABELS = {
  force: "kN",
  moment: "kN·m",
  length_m: "m",
  length_cm: "cm",
  stress_MPa: "MPa",
  stress_kPa: "kPa",
  area_cm2: "cm²",
} as const;

export const CM_TO_M = 0.01;
export const CM2_TO_M2 = 1e-4;
export const MPA_TO_KPA = 1000;
export const KN_PER_TF = 9.81;

export function cmToM(cm: number): number {
  return cm * CM_TO_M;
}

export function cm2ToM2(cm2: number): number {
  return cm2 * CM2_TO_M2;
}

export function mPaToKPa(mPa: number): number {
  return mPa * MPA_TO_KPA;
}

export function kNToTf(kN: number): number {
  return kN / KN_PER_TF;
}

export function diameterCmToAreaM2(diameterCm: number): number {
  const d = cmToM(diameterCm);
  return (Math.PI * d * d) / 4;
}

export function diameterCmToPerimeterM(diameterCm: number): number {
  return Math.PI * cmToM(diameterCm);
}
