import { defaultSteelGrade, getSteelWeightPerMeter } from "./steelProperties";
import { summarizeItems } from "./summarize";
import type { ElementTakeoff, RebarItem } from "./types";

export interface FootingTakeoffInput {
  elementRef?: string;
  /** Lado B da sapata (m). */
  B_m: number;
  /** Lado L da sapata (m). */
  L_m: number;
  thickness_m: number;
  /** Barra sugerida pelo footing-engine (mm). */
  bar_mm: number;
  /** Espaçamento sugerido (cm). */
  spacing_cm: number;
  cover_m?: number;
  concreteGrade?: string;
  lossPercentage?: number;
}

/**
 * Quantitativo da sapata isolada: malhas inferiores em X e Y (armadura de flexão)
 * a partir da malha calculada pelo footing-engine (CEB-70 e As,mín).
 */
export function computeFootingTakeoff(input: FootingTakeoffInput): ElementTakeoff {
  const lossPct = input.lossPercentage ?? 10.0;
  const cover = input.cover_m ?? 0.05;
  const spacing_m = Math.max(0.05, input.spacing_cm / 100);
  const weightPerM = getSteelWeightPerMeter(input.bar_mm);
  const grade = defaultSteelGrade(input.bar_mm);

  // Gancho vertical nas extremidades limitado pela altura útil.
  const hook_m = Math.max(0.1, Math.min(0.3, input.thickness_m - 2 * cover));

  const buildMesh = (name: string, spanLength_m: number, spread_m: number): RebarItem => {
    const count = Math.max(2, Math.ceil((spread_m - 2 * cover) / spacing_m) + 1);
    const unitLength_m = Number((Math.max(0.2, spanLength_m - 2 * cover) + 2 * hook_m).toFixed(2));
    const totalLength_m = Number((count * unitLength_m).toFixed(2));
    return {
      name,
      steelGrade: grade,
      diameter_mm: input.bar_mm,
      count,
      unitLength_m,
      totalLength_m,
      weightKgPerMeter: weightPerM,
      totalWeight_kg: Number((totalLength_m * weightPerM).toFixed(2)),
    };
  };

  const items: RebarItem[] = [
    buildMesh("Malha inferior X", input.B_m, input.L_m),
    buildMesh("Malha inferior Y", input.L_m, input.B_m),
  ];

  const summary = summarizeItems(items, lossPct);

  return {
    elementRef: input.elementRef ?? `SAPATA ${Math.round(input.B_m * 100)}x${Math.round(input.L_m * 100)}`,
    elementKind: "footing",
    concreteGrade: input.concreteGrade ?? "C25",
    concreteVolume_m3: Number((input.B_m * input.L_m * input.thickness_m).toFixed(2)),
    leanConcreteVolume_m3: Number(((input.B_m + 0.1) * (input.L_m + 0.1) * 0.05).toFixed(2)),
    items,
    ...summary,
    lossPercentage: lossPct,
  };
}
