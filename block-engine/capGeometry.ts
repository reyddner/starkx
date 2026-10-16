import type { BlockPileInstance, RectOutline } from "./types";

/** Contorno retangular do bloco = AABB das estacas + beiral. */
export function proposeRectangularCap(
  piles: BlockPileInstance[],
  edge_m: number,
  diameter_m: number,
): RectOutline {
  if (piles.length === 0) {
    throw new Error("bloco exige ao menos uma estaca");
  }
  const r = diameter_m / 2;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of piles) {
    minX = Math.min(minX, p.position.x_m - r);
    maxX = Math.max(maxX, p.position.x_m + r);
    minY = Math.min(minY, p.position.y_m - r);
    maxY = Math.max(maxY, p.position.y_m + r);
  }
  const e = Math.max(0, edge_m);
  const outline: RectOutline = {
    minX_m: minX - e,
    maxX_m: maxX + e,
    minY_m: minY - e,
    maxY_m: maxY + e,
    width_m: 0,
    length_m: 0,
  };
  outline.width_m = outline.maxX_m - outline.minX_m;
  outline.length_m = outline.maxY_m - outline.minY_m;
  return outline;
}
