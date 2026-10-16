import type { BlockPileInstance, Vec2 } from "./types";

/**
 * Grade retangular centrada na origem.
 * rows ao longo de y, cols ao longo de x.
 */
export function layoutRectangularGrid(
  rows: number,
  cols: number,
  spacing_m: number,
): BlockPileInstance[] {
  if (rows < 1 || cols < 1) {
    throw new Error("rows e cols devem ser ≥ 1");
  }
  if (!(spacing_m > 0)) {
    throw new Error("espaçamento deve ser > 0");
  }

  const piles: BlockPileInstance[] = [];
  const x0 = -((cols - 1) * spacing_m) / 2;
  const y0 = -((rows - 1) * spacing_m) / 2;
  let n = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      n += 1;
      const pos: Vec2 = {
        x_m: x0 + c * spacing_m,
        y_m: y0 + r * spacing_m,
      };
      piles.push({
        id: `pile-${r + 1}-${c + 1}`,
        label: `E${n}`,
        position: pos,
      });
    }
  }
  return piles;
}

export function defaultSpacing_m(
  diameter_m: number,
  factor = 2.5,
  absoluteMin_m = 0.8,
): number {
  return Math.max(factor * diameter_m, absoluteMin_m);
}

/**
 * Fator k do espaçamento mínimo s ≥ k·D: 2,5 para pré-moldadas e metálicas,
 * 3,0 para moldadas in loco (prática usual de projeto). Sem tipo: 3,0.
 */
export function minSpacingFactorForPileType(pileTypeId: number | null): number {
  return pileTypeId != null && [1, 2, 3, 4].includes(pileTypeId) ? 2.5 : 3.0;
}
