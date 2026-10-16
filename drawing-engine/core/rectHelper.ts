import type { Point2D } from "./types";

/**
 * Retângulo já resolvido em coordenadas de folha (mm, Y crescendo para baixo).
 * Evita o erro clássico de usar o canto do modelo (Y para cima) como canto da folha.
 */
export interface SheetRect {
  x: number;
  y: number;
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

/** Normaliza dois cantos quaisquer da folha em um retângulo válido. */
export function sheetRectFromPoints(a: Point2D, b: Point2D): SheetRect {
  const left = Math.min(a.x, b.x);
  const right = Math.max(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const bottom = Math.max(a.y, b.y);
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    left,
    right,
    top,
    bottom,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  };
}

/**
 * Projeta dois cantos do modelo (metros, Y para cima) num retângulo de folha.
 */
export function sheetRectFromModel(
  toSheetPoint: (p: Point2D) => Point2D,
  a: Point2D,
  b: Point2D,
): SheetRect {
  return sheetRectFromPoints(toSheetPoint(a), toSheetPoint(b));
}
