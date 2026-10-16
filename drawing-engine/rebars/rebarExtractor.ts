import type { ElementTakeoff } from "../../structural-engine/takeoff/types";
import type { RebarShapeDefinition, RebarShapeKind } from "./types";

export interface RebarExtractorContext {
  width_m?: number;
  length_m?: number;
  height_m?: number;
  cover_m?: number;
}

/**
 * Converte os itens de quantitativo (RebarItem) em definições geométricas
 * de barras abertas (RebarShapeDefinition) com cotas de cada trecho em cm.
 */
export function extractRebarShapes(
  takeoff: ElementTakeoff,
  ctx?: RebarExtractorContext,
): RebarShapeDefinition[] {
  const c = (ctx?.cover_m ?? 0.05) * 100; // cm
  const w_cm = (ctx?.width_m ?? 1.0) * 100;
  const l_cm = (ctx?.length_m ?? 1.0) * 100;
  const h_cm = (ctx?.height_m ?? 0.6) * 100;

  return takeoff.items.map((item, idx) => {
    const posNumber = idx + 1;
    const nameLower = item.name.toLowerCase();
    const unitCm = Math.round(item.unitLength_m * 100);

    let kind: RebarShapeKind = "straight";
    let legs_cm: number[] = [unitCm];

    if (nameLower.includes("estribo") || nameLower.includes("perimetral") || nameLower.includes("xy") || nameLower.includes("xz") || nameLower.includes("yz")) {
      kind = "closed_rect";
      if (nameLower.includes("xz")) {
        const sideA = Math.max(10, Math.round(w_cm - 2 * c));
        const sideB = Math.max(10, Math.round(h_cm - 2 * c));
        legs_cm = [sideA, sideB];
      } else if (nameLower.includes("yz")) {
        const sideA = Math.max(10, Math.round(l_cm - 2 * c));
        const sideB = Math.max(10, Math.round(h_cm - 2 * c));
        legs_cm = [sideA, sideB];
      } else {
        // XY ou padrão
        const sideA = Math.max(10, Math.round(w_cm - 2 * c));
        const sideB = Math.max(10, Math.round(l_cm - 2 * c));
        legs_cm = [sideA, sideB];
      }
    } else if (nameLower.includes("tirante") || nameLower.includes("malha") || nameLower.includes("inferior")) {
      kind = "u_shape";
      const hook = Math.min(35, Math.max(10, Math.round(h_cm - 2 * c)));
      if (nameLower.includes(" x")) {
        const main = Math.max(10, Math.round(l_cm - 2 * c));
        legs_cm = [hook, main, hook];
      } else if (nameLower.includes(" y")) {
        const main = Math.max(10, Math.round(w_cm - 2 * c));
        legs_cm = [hook, main, hook];
      } else {
        const main = Math.max(10, unitCm - 2 * hook);
        legs_cm = [hook, main, hook];
      }
    } else if (nameLower.includes("diagonal")) {
      kind = "diagonal";
      legs_cm = [unitCm];
    } else if (
      nameLower.includes("vertical") ||
      nameLower.includes("longitudinal") ||
      nameLower.includes("montante")
    ) {
      kind = "straight";
      legs_cm = [unitCm];
    } else if (nameLower.includes("espiral") || nameLower.includes("anel")) {
      kind = "circular_ring";
      const diam = Math.max(10, Math.round(w_cm - 2 * c));
      legs_cm = [diam];
    } else if (nameLower.includes("horizontal") && nameLower.includes("estrib")) {
      kind = "circular_ring";
      const diam = Math.max(10, Math.round(w_cm - 2 * c));
      legs_cm = [diam];
    } else if (nameLower.includes("superior") || nameLower.includes("reta")) {
      kind = "straight";
      legs_cm = [unitCm];
    } else {
      // Heurística de fallback baseada no comprimento
      if (unitCm > 150) {
        kind = "u_shape";
        const hook = 20;
        legs_cm = [hook, Math.max(10, unitCm - 40), hook];
      } else {
        kind = "straight";
        legs_cm = [unitCm];
      }
    }

    return {
      posNumber,
      label: `N${posNumber}`,
      name: item.name,
      diameter_mm: item.diameter_mm,
      steelGrade: item.steelGrade,
      count: item.count,
      totalLength_m: item.totalLength_m,
      unitLength_cm: unitCm,
      kind,
      legs_cm,
    };
  });
}
