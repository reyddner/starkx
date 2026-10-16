import type { DrawingPrimitive, RectPrimitive } from "../core/types";

export interface SheetDimensions {
  width_mm: number;
  height_mm: number;
  marginTop_mm: number;
  marginBottom_mm: number;
  marginLeft_mm: number;
  marginRight_mm: number;
  printableWidth_mm: number;
  printableHeight_mm: number;
}

export const A4_LANDSCAPE: SheetDimensions = {
  width_mm: 297,
  height_mm: 210,
  marginTop_mm: 10,
  marginBottom_mm: 10,
  marginLeft_mm: 20, // 20 mm para encadernação/margem esquerda ABNT
  marginRight_mm: 10,
  printableWidth_mm: 267,
  printableHeight_mm: 190,
};

/**
 * Desenha a moldura externa e a borda interna padronizada ABNT para folha A4 paisagem.
 */
export function drawSheetBorders(dims = A4_LANDSCAPE): DrawingPrimitive[] {
  const primitives: DrawingPrimitive[] = [];

  // Borda da área de desenho útil (respeitando margens)
  const innerBorder: RectPrimitive = {
    type: "rect",
    x: dims.marginLeft_mm,
    y: dims.marginTop_mm,
    width: dims.printableWidth_mm,
    height: dims.printableHeight_mm,
    strokeWidth: 0.7, // Traço principal grosso da folha
    strokeColor: "#000000",
  };
  primitives.push(innerBorder);

  return primitives;
}
