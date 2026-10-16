import { defaultSteelGrade, getSteelWeightPerMeter } from "./steelProperties";
import type { ElementTakeoff, RebarItem, SteelGrade } from "./types";

export interface PileTakeoffInput {
  elementRef?: string;
  diameter_m: number;
  length_m: number;
  longitudinalCount: number;
  longitudinalDia_mm: number;
  transverseDia_mm: number;
  transverseSpacing_m: number;
  transverseKind?: "stirrup" | "spiral";
  cover_m?: number;
  cageLength_m?: number;
  anchorageLength_m?: number;
  concreteGrade?: string;
  lossPercentage?: number;
}

export function computePileTakeoff(input: PileTakeoffInput): ElementTakeoff {
  const lossPct = input.lossPercentage ?? 10.0;
  const cover = input.cover_m ?? 0.05;
  const cageL = input.cageLength_m ?? input.length_m;
  const diaCapAnchorage = input.anchorageLength_m ?? Math.max(0.45, (40 * input.longitudinalDia_mm) / 1000);
  const longUnitLen = Number((cageL + diaCapAnchorage).toFixed(2));
  const longWeightPerM = getSteelWeightPerMeter(input.longitudinalDia_mm);
  const longTotLen = Number((input.longitudinalCount * longUnitLen).toFixed(2));
  const longWeight = Number((longTotLen * longWeightPerM).toFixed(2));

  const items: RebarItem[] = [
    {
      name: "Armadura vertical",
      steelGrade: defaultSteelGrade(input.longitudinalDia_mm),
      diameter_mm: input.longitudinalDia_mm,
      count: input.longitudinalCount,
      unitLength_m: longUnitLen,
      totalLength_m: longTotLen,
      weightKgPerMeter: longWeightPerM,
      totalWeight_kg: longWeight,
    },
  ];

  const stirrupDia_m = Math.max(0.1, input.diameter_m - 2 * cover);
  const stirrupWeightPerM = getSteelWeightPerMeter(input.transverseDia_mm);

  if (input.transverseKind === "spiral") {
    const turns = Math.max(1, Math.ceil(cageL / input.transverseSpacing_m));
    // Uma volta da hélice: hipotenusa de (perímetro π·d, passo s).
    const stepL = Math.hypot(Math.PI * stirrupDia_m, input.transverseSpacing_m);
    const spiralLen = Number((turns * stepL + 2 * Math.PI * stirrupDia_m).toFixed(2));
    const spiralWeight = Number((spiralLen * stirrupWeightPerM).toFixed(2));
    items.push({
      name: "Armadura espiral",
      steelGrade: defaultSteelGrade(input.transverseDia_mm),
      diameter_mm: input.transverseDia_mm,
      count: 1,
      unitLength_m: spiralLen,
      totalLength_m: spiralLen,
      weightKgPerMeter: stirrupWeightPerM,
      totalWeight_kg: spiralWeight,
    });
  } else {
    const stirrupCount = Math.max(1, Math.ceil(cageL / input.transverseSpacing_m) + 1);
    const hook_m = 0.10;
    const stirrupUnitLen = Number((Math.PI * stirrupDia_m + hook_m).toFixed(2));
    const stirrupTotLen = Number((stirrupCount * stirrupUnitLen).toFixed(2));
    const stirrupWeight = Number((stirrupTotLen * stirrupWeightPerM).toFixed(2));
    items.push({
      name: "Armadura horizontal (estribos)",
      steelGrade: defaultSteelGrade(input.transverseDia_mm),
      diameter_mm: input.transverseDia_mm,
      count: stirrupCount,
      unitLength_m: stirrupUnitLen,
      totalLength_m: stirrupTotLen,
      weightKgPerMeter: stirrupWeightPerM,
      totalWeight_kg: stirrupWeight,
    });
  }

  const byDiameter: Record<number, {
    steelGrade: SteelGrade;
    totalLength_m: number;
    weight_kg: number;
    weightWithLoss_kg: number;
  }> = {};

  let totalSteelWeight_kg = 0;
  for (const item of items) {
    totalSteelWeight_kg += item.totalWeight_kg;
    if (!byDiameter[item.diameter_mm]) {
      byDiameter[item.diameter_mm] = {
        steelGrade: item.steelGrade,
        totalLength_m: 0,
        weight_kg: 0,
        weightWithLoss_kg: 0,
      };
    }
    const d = byDiameter[item.diameter_mm];
    d.totalLength_m = Number((d.totalLength_m + item.totalLength_m).toFixed(2));
    d.weight_kg = Number((d.weight_kg + item.totalWeight_kg).toFixed(2));
    d.weightWithLoss_kg = Number((d.weight_kg * (1 + lossPct / 100)).toFixed(2));
  }

  totalSteelWeight_kg = Number(totalSteelWeight_kg.toFixed(2));
  const totalSteelWithLosses_kg = Number((totalSteelWeight_kg * (1 + lossPct / 100)).toFixed(2));

  const radius = input.diameter_m / 2;
  const concreteVolume_m3 = Number((Math.PI * radius * radius * input.length_m).toFixed(2));

  return {
    elementRef: input.elementRef ?? `ESTACA ${Math.round(input.diameter_m * 100)}cm`,
    elementKind: "pile",
    concreteGrade: input.concreteGrade ?? "C20",
    concreteVolume_m3,
    leanConcreteVolume_m3: 0,
    items,
    totalSteelWeight_kg,
    totalSteelWithLosses_kg,
    lossPercentage: lossPct,
    byDiameter,
  };
}
