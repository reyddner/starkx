import { createLinearDimension } from "../../core/dimensionHelper";
import { STANDARD_SCALES, type DrawingPrimitive, type SheetViewport } from "../../core/types";

export interface PileLongSectionInput {
  /** Caixa útil do corte na folha (mm). */
  box: SheetViewport;
  diameter_m: number;
  /** Comprimento do fuste (m). */
  length_m: number;
  /** Comprimento armado a partir do topo (m). */
  cageLength_m: number;
  cover_m: number;
}

export interface PileLongSectionResult {
  primitives: DrawingPrimitive[];
  scaleLabel: string;
  /** true quando o fuste foi representado com quebra (trechos topo/ponta). */
  broken: boolean;
}

/** Largura mínima do fuste na folha para o desenho ser legível. */
const MIN_SHAFT_WIDTH_MM = 7;
/** Altura reservada à quebra (linhas de interrupção + cota). */
const BREAK_GAP_MM = 9;

interface Chosen {
  mmPerMeter: number;
  label: string;
}

/** Escala mais detalhada que caiba na caixa desenhando o fuste inteiro. */
function fullViewScale(D: number, L: number, availW: number, availH: number): Chosen | null {
  for (const s of STANDARD_SCALES) {
    const mmPerMeter = 1000 / s.factor;
    if (D * mmPerMeter < MIN_SHAFT_WIDTH_MM) continue;
    if (D * 2.4 * mmPerMeter <= availW && L * mmPerMeter <= availH) {
      return { mmPerMeter, label: s.label };
    }
  }
  return null;
}

/**
 * Escala da vista com quebra: prioriza a legibilidade do fuste, pois os trechos
 * desenhados são recortados depois em função da altura disponível.
 */
function brokenViewScale(D: number, availW: number, availH: number): Chosen {
  const minDrawn_m = 0.9;
  let widthFit: Chosen | null = null;
  for (const s of STANDARD_SCALES) {
    const mmPerMeter = 1000 / s.factor;
    if (D * 2.4 * mmPerMeter > availW) continue;
    widthFit ??= { mmPerMeter, label: s.label };
    if (minDrawn_m * mmPerMeter + BREAK_GAP_MM > availH) continue;
    if (D * mmPerMeter >= MIN_SHAFT_WIDTH_MM) return { mmPerMeter, label: s.label };
  }
  const last = STANDARD_SCALES[STANDARD_SCALES.length - 1]!;
  return widthFit ?? { mmPerMeter: 1000 / last.factor, label: last.label };
}

function breakLines(xLeft: number, xRight: number, y: number): DrawingPrimitive[] {
  const mid = (xLeft + xRight) / 2;
  const zig = (yBase: number): DrawingPrimitive[] => [
    {
      type: "line",
      x1: xLeft - 1.5,
      y1: yBase,
      x2: mid,
      y2: yBase - 1.6,
      strokeWidth: 0.35,
      strokeColor: "#000000",
    },
    {
      type: "line",
      x1: mid,
      y1: yBase - 1.6,
      x2: xRight + 1.5,
      y2: yBase,
      strokeWidth: 0.35,
      strokeColor: "#000000",
    },
  ];
  return [...zig(y), ...zig(y + 2.4)];
}

/**
 * Corte longitudinal da estaca. Estacas esbeltas (L/D alto) não cabem em escala
 * legível numa folha A4: nesses casos desenha-se o trecho de topo e o de ponta
 * com quebra no meio, mantendo a cota do comprimento real.
 */
export function drawPileLongSection(input: PileLongSectionInput): PileLongSectionResult {
  const D = input.diameter_m;
  const L = Math.max(0.5, input.length_m);
  const cageL = Math.min(L, Math.max(0.3, input.cageLength_m));
  const cover = Math.min(input.cover_m, D / 4);
  const box = input.box;

  const primitives: DrawingPrimitive[] = [];
  const availW = box.width * 0.72;
  const availH = box.height - 10;

  const full = fullViewScale(D, L + 0.3, availW, availH);
  const chosen = full ?? brokenViewScale(D, availW, availH);
  // Na vista com quebra os trechos vêm da altura disponível (não o contrário),
  // garantindo fuste legível e desenho dentro da caixa.
  const drawable_m = full != null ? L : (availH - BREAK_GAP_MM) / chosen.mmPerMeter;
  const topSeg_m = full != null ? L : Math.min(L * 0.45, drawable_m * 0.6);
  const botSeg_m = full != null ? 0 : Math.min(L * 0.3, drawable_m * 0.4);

  const shaftW = D * chosen.mmPerMeter;
  const cx = box.x + box.width / 2;
  const left = cx - shaftW / 2;
  const drawnH = (topSeg_m + botSeg_m) * chosen.mmPerMeter + (full != null ? 0 : BREAK_GAP_MM);
  const top = box.y + 8 + Math.max(0, (availH - drawnH) / 2);

  const topSegH = topSeg_m * chosen.mmPerMeter;
  const botSegH = botSeg_m * chosen.mmPerMeter;
  const botSegTop = top + topSegH + (full != null ? 0 : BREAK_GAP_MM);
  const bottom = botSegTop + botSegH;

  const shaftSegments: { y: number; height: number }[] =
    full != null
      ? [{ y: top, height: topSegH }]
      : [
          { y: top, height: topSegH },
          { y: botSegTop, height: botSegH },
        ];

  for (const seg of shaftSegments) {
    primitives.push({
      type: "rect",
      x: left,
      y: seg.y,
      width: shaftW,
      height: seg.height,
      strokeWidth: 0.5,
      strokeColor: "#000000",
      fillColor: "#e6eef5",
    });
  }

  if (full == null) {
    primitives.push(...breakLines(left, left + shaftW, top + topSegH));
    primitives.push({
      type: "text",
      text: `trecho omitido ≈ ${(L - topSeg_m - botSeg_m).toFixed(1)} m`,
      x: cx,
      y: top + topSegH + BREAK_GAP_MM / 2 + 1.2,
      fontSize: 3.6,
      align: "center",
      baseline: "middle",
      color: "#777777",
    });
  }

  // Gaiola e longitudinais: sempre a partir do topo, limitadas ao trecho desenhado.
  const cageDrawnH = Math.min(topSegH, cageL * chosen.mmPerMeter);
  primitives.push({
    type: "rect",
    x: left + cover * chosen.mmPerMeter,
    y: top,
    width: Math.max(0.5, shaftW - 2 * cover * chosen.mmPerMeter),
    height: cageDrawnH,
    strokeWidth: 0.35,
    strokeColor: "#b30000",
    dashPattern: [2, 1.2],
  });
  for (const sx of [left + cover * chosen.mmPerMeter, left + shaftW - cover * chosen.mmPerMeter]) {
    primitives.push({
      type: "line",
      x1: sx,
      y1: top,
      x2: sx,
      y2: top + cageDrawnH,
      strokeWidth: 0.55,
      strokeColor: "#b30000",
    });
  }

  // Cotas: comprimento total (valor real, mesmo com quebra) e trecho armado.
  primitives.push(
    ...createLinearDimension({
      start: { x: left, y: top },
      end: { x: left, y: bottom },
      offset_mm: -7,
      measurement_cm: Math.round(L * 100),
      orientation: "vertical",
      fontSize: 4.4,
    }),
  );
  if (cageL + 1e-6 < L) {
    primitives.push(
      ...createLinearDimension({
        start: { x: left + shaftW, y: top },
        end: { x: left + shaftW, y: top + cageDrawnH },
        offset_mm: 6,
        measurement_cm: Math.round(cageL * 100),
        orientation: "vertical",
        fontSize: 4.4,
      }),
    );
  }

  primitives.push({
    type: "text",
    text: `Ø${Math.round(D * 100)}`,
    x: cx,
    y: bottom + 4,
    fontSize: 4.2,
    align: "center",
    baseline: "middle",
    color: "#333333",
  });

  return {
    primitives,
    scaleLabel: full != null ? chosen.label : `${chosen.label} c/ quebra`,
    broken: full == null,
  };
}
