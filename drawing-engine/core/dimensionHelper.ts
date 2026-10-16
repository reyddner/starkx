import type { DrawingPrimitive, Point2D, TextPrimitive } from "./types";

export interface LinearDimensionOptions {
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  start?: Point2D;
  end?: Point2D;
  /**
   * Deslocamento da linha de cota em mm (folha).
   * Com `orientation`:
   * - horizontal: + = abaixo, − = acima
   * - vertical:   + = direita, − = esquerda
   * Sem orientation: perpendicular geométrica à direção start→end (legado).
   */
  offset_mm: number;
  text?: string;
  measurement_cm?: number;
  value_m?: number;
  unit?: "cm" | "m";
  fontSize?: number;
  tickSize_mm?: number;
  orientation?: "horizontal" | "vertical" | "aligned";
  /** Máscara branca atrás do texto (default true). */
  textMask?: boolean;
}

/**
 * Vetores da cota: paralelo geométrico (start→end) + normal de offset.
 */
export function dimensionAxes(
  orientation: "horizontal" | "vertical" | "aligned" | undefined,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { nx: number; ny: number; ux: number; uy: number; len: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) {
    return { nx: 0, ny: 1, ux: 1, uy: 0, len: 0 };
  }
  const ux = dx / len;
  const uy = dy / len;

  if (orientation === "horizontal") {
    // +offset → abaixo (Y+), independente do sentido left→right / right→left
    return { nx: 0, ny: 1, ux, uy, len };
  }
  if (orientation === "vertical") {
    // +offset → direita (X+)
    return { nx: 1, ny: 0, ux, uy, len };
  }

  // aligned / legado: perpendicular à "esquerda" de start→end
  return { nx: -uy, ny: ux, ux, uy, len };
}

/**
 * Gera as primitivas de uma linha de cota técnica completa.
 */
export function createLinearDimension(opts: LinearDimensionOptions): DrawingPrimitive[] {
  const x1 = opts.x1 ?? opts.start?.x ?? 0;
  const y1 = opts.y1 ?? opts.start?.y ?? 0;
  const x2 = opts.x2 ?? opts.end?.x ?? 0;
  const y2 = opts.y2 ?? opts.end?.y ?? 0;
  const offset_mm = opts.offset_mm ?? 5;
  const fontSize = opts.fontSize ?? 3.8;
  const tickSize_mm = opts.tickSize_mm ?? 1.6;
  const useMask = opts.textMask !== false;

  const { nx, ny, ux, uy, len } = dimensionAxes(opts.orientation, x1, y1, x2, y2);
  if (len < 1e-4) return [];

  const cx1 = x1 + nx * offset_mm;
  const cy1 = y1 + ny * offset_mm;
  const cx2 = x2 + nx * offset_mm;
  const cy2 = y2 + ny * offset_mm;

  const primitives: DrawingPrimitive[] = [];
  const dir = Math.sign(offset_mm) || 1;
  const extGap = 0.6;
  const extOver = 1.2;

  primitives.push(
    {
      type: "line",
      x1: x1 + nx * extGap * dir,
      y1: y1 + ny * extGap * dir,
      x2: cx1 + nx * extOver * dir,
      y2: cy1 + ny * extOver * dir,
      strokeWidth: 0.22,
      strokeColor: "#555555",
    },
    {
      type: "line",
      x1: x2 + nx * extGap * dir,
      y1: y2 + ny * extGap * dir,
      x2: cx2 + nx * extOver * dir,
      y2: cy2 + ny * extOver * dir,
      strokeWidth: 0.22,
      strokeColor: "#555555",
    },
  );

  let text = opts.text;
  if (!text) {
    if (opts.measurement_cm != null) {
      text = String(Math.round(opts.measurement_cm));
    } else if (opts.value_m != null) {
      text =
        opts.unit === "m"
          ? `${opts.value_m.toFixed(2)}m`
          : String(Math.round(opts.value_m * 100));
    } else {
      text = String(Math.round(len));
    }
  }

  const midX = (cx1 + cx2) / 2;
  const midY = (cy1 + cy2) / 2;
  const textGap = Math.max(2.4, fontSize * 0.6);
  const textMidX = midX + nx * textGap * dir;
  const textMidY = midY + ny * textGap * dir;

  const textHalf = Math.max(2.5, text.length * fontSize * 0.28);
  const gap = Math.min(textHalf, len * 0.4);

  if (len > gap * 2 + 1.5) {
    primitives.push(
      {
        type: "line",
        x1: cx1,
        y1: cy1,
        x2: midX - ux * gap,
        y2: midY - uy * gap,
        strokeWidth: 0.3,
        strokeColor: "#000000",
      },
      {
        type: "line",
        x1: midX + ux * gap,
        y1: midY + uy * gap,
        x2: cx2,
        y2: cy2,
        strokeWidth: 0.3,
        strokeColor: "#000000",
      },
    );
  } else {
    primitives.push({
      type: "line",
      x1: cx1,
      y1: cy1,
      x2: cx2,
      y2: cy2,
      strokeWidth: 0.3,
      strokeColor: "#000000",
    });
  }

  const tickCos = (ux - uy) * 0.7071 * tickSize_mm;
  const tickSin = (ux + uy) * 0.7071 * tickSize_mm;
  primitives.push(
    {
      type: "line",
      x1: cx1 - tickCos,
      y1: cy1 - tickSin,
      x2: cx1 + tickCos,
      y2: cy1 + tickSin,
      strokeWidth: 0.45,
      strokeColor: "#000000",
    },
    {
      type: "line",
      x1: cx2 - tickCos,
      y1: cy2 - tickSin,
      x2: cx2 + tickCos,
      y2: cy2 + tickSin,
      strokeWidth: 0.45,
      strokeColor: "#000000",
    },
  );

  if (useMask) {
    const maskW = Math.max(4, text.length * fontSize * 0.55 + 1.5);
    const maskH = fontSize + 1.2;
    primitives.push({
      type: "rect",
      x: textMidX - maskW / 2,
      y: textMidY - maskH / 2,
      width: maskW,
      height: maskH,
      strokeWidth: 0,
      strokeColor: "#ffffff",
      fillColor: "#ffffff",
    });
  }

  const textPrim: TextPrimitive = {
    type: "text",
    text,
    x: textMidX,
    y: textMidY,
    fontSize,
    align: "center",
    baseline: "middle",
    color: "#000000",
    bold: true,
  };
  primitives.push(textPrim);

  return primitives;
}
