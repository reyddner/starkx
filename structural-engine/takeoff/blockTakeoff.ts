import { defaultSteelGrade, getSteelWeightPerMeter } from "./steelProperties";
import type { ElementTakeoff, RebarItem, SteelGrade } from "./types";

export interface BlockTakeoffInput {
  elementRef?: string;
  pileCount: number;
  width_m: number;
  length_m: number;
  thickness_m: number;
  pileDiameter_m?: number;
  cover_m?: number;
  concreteGrade?: string;
  leanConcreteThickness_m?: number;
  lossPercentage?: number;
  suggestedBar_mm?: number;
  suggestedSpacing_cm?: number;
  /** Tirantes calculados (barras paralelas a x e a y). */
  tieX?: { bar_mm: number; count: number };
  tieY?: { bar_mm: number; count: number };
}

function computeSinglePileCapRebars(b_m: number, l_m: number, h_m: number, cover: number): RebarItem[] {
  const c = cover;
  const periXY = Number((2 * (b_m - 2 * c + l_m - 2 * c) + 0.20).toFixed(2));
  const periXZ = Number((2 * (b_m - 2 * c + h_m - 2 * c) + 0.20).toFixed(2));
  const periYZ = Number((2 * (l_m - 2 * c + h_m - 2 * c) + 0.20).toFixed(2));
  const diagLen = Number((Math.sqrt((b_m - 2 * c) ** 2 + (l_m - 2 * c) ** 2 + (h_m - 2 * c) ** 2) * 2 + 0.15).toFixed(2));

  const dia10 = 10.0;
  const w10 = getSteelWeightPerMeter(dia10);
  const dia42 = 4.2;
  const w42 = getSteelWeightPerMeter(dia42);

  return [
    {
      name: "Armadura estribos XY (horizontal)",
      steelGrade: defaultSteelGrade(dia10),
      diameter_mm: dia10,
      count: 2,
      unitLength_m: periXY,
      totalLength_m: Number((2 * periXY).toFixed(2)),
      weightKgPerMeter: w10,
      totalWeight_kg: Number((2 * periXY * w10).toFixed(2)),
    },
    {
      name: "Armadura estribos XZ (vertical)",
      steelGrade: defaultSteelGrade(dia10),
      diameter_mm: dia10,
      count: 2,
      unitLength_m: periXZ,
      totalLength_m: Number((2 * periXZ).toFixed(2)),
      weightKgPerMeter: w10,
      totalWeight_kg: Number((2 * periXZ * w10).toFixed(2)),
    },
    {
      name: "Armadura estribos YZ (vertical)",
      steelGrade: defaultSteelGrade(dia10),
      diameter_mm: dia10,
      count: 2,
      unitLength_m: periYZ,
      totalLength_m: Number((2 * periYZ).toFixed(2)),
      weightKgPerMeter: w10,
      totalWeight_kg: Number((2 * periYZ * w10).toFixed(2)),
    },
    {
      name: "Armadura diagonal (fendilhamento)",
      steelGrade: defaultSteelGrade(dia42),
      diameter_mm: dia42,
      count: 2,
      unitLength_m: diagLen,
      totalLength_m: Number((2 * diagLen).toFixed(2)),
      weightKgPerMeter: w42,
      totalWeight_kg: Number((2 * diagLen * w42).toFixed(2)),
    },
  ];
}

function computeTwoPileCapRebars(
  longSide_m: number,
  shortSide_m: number,
  h_m: number,
  cover: number,
  tie: { bar_mm: number; count: number },
): RebarItem[] {
  // O tirante corre na direção das estacas (lado longo), com ganchos verticais nas pontas.
  const b_m = shortSide_m;
  const l_m = longSide_m;
  const c = cover;
  const barDia = tie.bar_mm;
  const tieLen = Number((l_m - 2 * c + 2 * Math.min(0.40, h_m - 2 * c)).toFixed(2));
  const tieCount = tie.count;
  const tieWeightPerM = getSteelWeightPerMeter(barDia);
  const tieTotLen = Number((tieCount * tieLen).toFixed(2));

  const supDia = 10.0;
  const supCount = Math.max(4, Math.round(b_m / 0.20));
  const supWeightPerM = getSteelWeightPerMeter(supDia);
  const supLen = Number((l_m - 2 * c + 0.20).toFixed(2));
  const supTotLen = Number((supCount * supLen).toFixed(2));

  const vertStirrupDia = 10.0;
  const vertWeightPerM = getSteelWeightPerMeter(vertStirrupDia);
  const vertSpacing = 0.15;
  const vertCount = Math.max(4, Math.ceil(l_m / vertSpacing));
  const vertUnitLen = Number((2 * (b_m - 2 * c + h_m - 2 * c) + 0.20).toFixed(2));
  const vertTotLen = Number((vertCount * vertUnitLen).toFixed(2));

  const horizStirrupDia = 10.0;
  const horizWeightPerM = getSteelWeightPerMeter(horizStirrupDia);
  const horizCount = Math.max(2, Math.floor(h_m / 0.25));
  const horizUnitLen = Number((2 * (b_m - 2 * c + l_m - 2 * c) + 0.20).toFixed(2));
  const horizTotLen = Number((horizCount * horizUnitLen).toFixed(2));

  return [
    {
      name: "Tirante inferior (viga linear)",
      steelGrade: defaultSteelGrade(barDia),
      diameter_mm: barDia,
      count: tieCount,
      unitLength_m: tieLen,
      totalLength_m: tieTotLen,
      weightKgPerMeter: tieWeightPerM,
      totalWeight_kg: Number((tieTotLen * tieWeightPerM).toFixed(2)),
    },
    {
      name: "Armadura superior (viga linear)",
      steelGrade: defaultSteelGrade(supDia),
      diameter_mm: supDia,
      count: supCount,
      unitLength_m: supLen,
      totalLength_m: supTotLen,
      weightKgPerMeter: supWeightPerM,
      totalWeight_kg: Number((supTotLen * supWeightPerM).toFixed(2)),
    },
    {
      name: "Estribos verticais",
      steelGrade: defaultSteelGrade(vertStirrupDia),
      diameter_mm: vertStirrupDia,
      count: vertCount,
      unitLength_m: vertUnitLen,
      totalLength_m: vertTotLen,
      weightKgPerMeter: vertWeightPerM,
      totalWeight_kg: Number((vertTotLen * vertWeightPerM).toFixed(2)),
    },
    {
      name: "Estribos horizontais",
      steelGrade: defaultSteelGrade(horizStirrupDia),
      diameter_mm: horizStirrupDia,
      count: horizCount,
      unitLength_m: horizUnitLen,
      totalLength_m: horizTotLen,
      weightKgPerMeter: horizWeightPerM,
      totalWeight_kg: Number((horizTotLen * horizWeightPerM).toFixed(2)),
    },
  ];
}

function computeGridCapRebars(
  b_m: number,
  l_m: number,
  h_m: number,
  cover: number,
  barDia: number,
  spacing_m: number,
  tieX?: { bar_mm: number; count: number },
  tieY?: { bar_mm: number; count: number },
): RebarItem[] {
  const c = cover;
  const hook_m = Number((Math.min(0.35, h_m - 2 * c)).toFixed(2));
  // Barras "X" correm ao longo de y (comprimento l); barras "Y" ao longo de x (largura b).
  const lenX = Number((l_m - 2 * c + 2 * hook_m).toFixed(2));
  const lenY = Number((b_m - 2 * c + 2 * hook_m).toFixed(2));

  // Malha + barras de tirante sobre as estacas (tirante paralelo a x usa barras ao longo de x).
  const countX = Math.max(3, Math.ceil(b_m / spacing_m) + 1) + (tieY?.count ?? 0);
  const countY = Math.max(3, Math.ceil(l_m / spacing_m) + 1) + (tieX?.count ?? 0);

  const w = getSteelWeightPerMeter(barDia);
  const totX = Number((countX * lenX).toFixed(2));
  const totY = Number((countY * lenY).toFixed(2));

  const periDia = 10.0;
  const wPeri = getSteelWeightPerMeter(periDia);
  const periUnit = Number((2 * (b_m - 2 * c + l_m - 2 * c) + 0.20).toFixed(2));
  const periCount = Math.max(2, Math.floor(h_m / 0.30));
  const periTot = Number((periCount * periUnit).toFixed(2));

  return [
    {
      name: "Armadura base - Malha inferior X",
      steelGrade: defaultSteelGrade(barDia),
      diameter_mm: barDia,
      count: countX,
      unitLength_m: lenX,
      totalLength_m: totX,
      weightKgPerMeter: w,
      totalWeight_kg: Number((totX * w).toFixed(2)),
    },
    {
      name: "Armadura base - Malha inferior Y",
      steelGrade: defaultSteelGrade(barDia),
      diameter_mm: barDia,
      count: countY,
      unitLength_m: lenY,
      totalLength_m: totY,
      weightKgPerMeter: w,
      totalWeight_kg: Number((totY * w).toFixed(2)),
    },
    {
      name: "Armadura perimetral de borda",
      steelGrade: defaultSteelGrade(periDia),
      diameter_mm: periDia,
      count: periCount,
      unitLength_m: periUnit,
      totalLength_m: periTot,
      weightKgPerMeter: wPeri,
      totalWeight_kg: Number((periTot * wPeri).toFixed(2)),
    },
  ];
}

export function computeBlockTakeoff(input: BlockTakeoffInput): ElementTakeoff {
  const lossPct = input.lossPercentage ?? 10.0;
  const cover = input.cover_m ?? 0.05;
  const barDia = input.suggestedBar_mm ?? 10.0;
  const spacing_m = (input.suggestedSpacing_cm ?? 15) / 100;
  const b = input.width_m;
  const l = input.length_m;
  const h = input.thickness_m;

  let items: RebarItem[];
  if (input.pileCount === 1) {
    items = computeSinglePileCapRebars(b, l, h, cover);
  } else if (input.pileCount === 2) {
    const tie = (b >= l ? input.tieX : input.tieY) ?? { bar_mm: barDia, count: 4 };
    items = computeTwoPileCapRebars(Math.max(b, l), Math.min(b, l), h, cover, tie);
  } else {
    items = computeGridCapRebars(b, l, h, cover, barDia, spacing_m, input.tieX, input.tieY);
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

  const concreteVolume_m3 = Number((b * l * h).toFixed(2));
  const leanH = input.leanConcreteThickness_m ?? 0.10;
  const leanConcreteVolume_m3 = Number((b * l * leanH).toFixed(2));

  return {
    elementRef: input.elementRef ?? `Bloco de ${input.pileCount} estaca${input.pileCount > 1 ? "s" : ""}`,
    elementKind: "pile_cap",
    concreteGrade: input.concreteGrade ?? "C30",
    concreteVolume_m3,
    leanConcreteVolume_m3,
    items,
    totalSteelWeight_kg,
    totalSteelWithLosses_kg,
    lossPercentage: lossPct,
    byDiameter,
  };
}
