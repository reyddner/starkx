import type { ElementTakeoff, ProjectTakeoffSummary } from "./types";

/**
 * Consolida a medição total da obra a partir dos quantitativos de cada elemento,
 * gerando o quadro de aço por diâmetro e os volumes de concreto.
 */
export function aggregateProjectTakeoff(
  elements: ElementTakeoff[],
  lossPercentage = 10.0,
): ProjectTakeoffSummary {
  const ca50ByDiameter_kg: Record<number, number> = {};
  const ca60ByDiameter_kg: Record<number, number> = {};
  const concreteByGrade_m3: Record<string, number> = {};
  let totalCA50_kg = 0;
  let totalCA60_kg = 0;
  let totalLeanConcrete_m3 = 0;

  for (const el of elements) {
    // Concreto estrutural por classe
    const grade = el.concreteGrade || "C25";
    concreteByGrade_m3[grade] = Number(((concreteByGrade_m3[grade] ?? 0) + el.concreteVolume_m3).toFixed(2));
    totalLeanConcrete_m3 = Number((totalLeanConcrete_m3 + el.leanConcreteVolume_m3).toFixed(2));

    // Aço por posição e diâmetro (com perdas)
    for (const [diaStr, d] of Object.entries(el.byDiameter)) {
      const dia = Number(diaStr);
      const weightWithLoss = d.weightWithLoss_kg;

      if (d.steelGrade === "CA-60") {
        ca60ByDiameter_kg[dia] = Number(((ca60ByDiameter_kg[dia] ?? 0) + weightWithLoss).toFixed(2));
        totalCA60_kg = Number((totalCA60_kg + weightWithLoss).toFixed(2));
      } else {
        ca50ByDiameter_kg[dia] = Number(((ca50ByDiameter_kg[dia] ?? 0) + weightWithLoss).toFixed(2));
        totalCA50_kg = Number((totalCA50_kg + weightWithLoss).toFixed(2));
      }
    }
  }

  const totalSteel_kg = Number((totalCA50_kg + totalCA60_kg).toFixed(2));

  return {
    elements,
    lossPercentage,
    ca50ByDiameter_kg,
    ca60ByDiameter_kg,
    totalCA50_kg,
    totalCA60_kg,
    totalSteel_kg,
    concreteByGrade_m3,
    totalLeanConcrete_m3,
  };
}
