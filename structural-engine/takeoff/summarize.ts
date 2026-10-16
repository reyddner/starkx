import type { ElementTakeoff, RebarItem, SteelGrade } from "./types";

export type ItemsSummary = Pick<
  ElementTakeoff,
  "totalSteelWeight_kg" | "totalSteelWithLosses_kg" | "byDiameter"
>;

/**
 * Consolida peso total e resumo por diâmetro de uma lista de posições.
 * Centraliza a regra de perdas usada por todos os takeoffs de elemento.
 */
export function summarizeItems(items: RebarItem[], lossPercentage: number): ItemsSummary {
  const byDiameter: Record<
    number,
    {
      steelGrade: SteelGrade;
      totalLength_m: number;
      weight_kg: number;
      weightWithLoss_kg: number;
    }
  > = {};

  let total = 0;
  for (const item of items) {
    total += item.totalWeight_kg;
    if (!byDiameter[item.diameter_mm]) {
      byDiameter[item.diameter_mm] = {
        steelGrade: item.steelGrade,
        totalLength_m: 0,
        weight_kg: 0,
        weightWithLoss_kg: 0,
      };
    }
    const d = byDiameter[item.diameter_mm]!;
    d.totalLength_m = Number((d.totalLength_m + item.totalLength_m).toFixed(2));
    d.weight_kg = Number((d.weight_kg + item.totalWeight_kg).toFixed(2));
    d.weightWithLoss_kg = Number((d.weight_kg * (1 + lossPercentage / 100)).toFixed(2));
  }

  const totalSteelWeight_kg = Number(total.toFixed(2));
  return {
    totalSteelWeight_kg,
    totalSteelWithLosses_kg: Number((totalSteelWeight_kg * (1 + lossPercentage / 100)).toFixed(2)),
    byDiameter,
  };
}
