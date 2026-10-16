import type {
  A4Sheet,
  DrawingPrimitive,
  TitleBlockInfo,
} from "../core/types";
import { createLinearDimension } from "../core/dimensionHelper";
import { createModelToSheetTransform, selectBestScale } from "../core/autoScale";
import { fitTextToWidth } from "../core/textFit";
import { drawPileLongSection } from "./pile/drawPileLongSection";
import { drawRebarShape } from "../rebars/rebarShapeDrafter";
import { extractRebarShapes } from "../rebars/rebarExtractor";
import { drawRebarTable } from "./drawRebarTable";
import { drawTitleBlock } from "./drawTitleBlock";
import { drawSheetBorders } from "./sheetBorders";
import type { ElementTakeoff } from "../../structural-engine/takeoff/types";

export interface PileSheetInput {
  diameter_m: number;
  /** Comprimento do fuste L (m). */
  length_m: number;
  /** Quantidade de estacas iguais no projeto (anotação). */
  pileCount: number;
  titleInfo: TitleBlockInfo;
  /** Opcional: sem takeoff a prancha ainda desenha seção e corte. */
  takeoff?: ElementTakeoff;
  longitudinalCount?: number;
  longitudinalDia_mm?: number;
  cageLength_m?: number;
  transverseKind?: "stirrup" | "spiral";
}

/**
 * Prancha A4 de estaca típica: seção transversal, corte do fuste/gaiola,
 * desdobramento e relação de aço (a partir de structural.takeoff).
 *
 * Layout 3 colunas (sem sobreposição):
 *   vistas 22–95 | desdobramento 98–180 | tabela/carimbo 185–287
 */
export function drawPileSheet(input: PileSheetInput): A4Sheet {
  const D = input.diameter_m;
  const L = Math.max(0.5, input.length_m);
  const cageL = Math.min(L, Math.max(0.5, input.cageLength_m ?? L));
  const takeoff = input.takeoff;

  // Prioriza contagem do takeoff (armadura vertical) para bater desenho × tabela
  const fromTakeoff = takeoff?.items.find(
    (i) =>
      /vertical|longitud/i.test(i.name) ||
      (i.steelGrade === "CA-50" && i.diameter_mm >= 8),
  )?.count;
  const nLong = fromTakeoff ?? input.longitudinalCount ?? 6;

  const primitives: DrawingPrimitive[] = [];
  primitives.push(...drawSheetBorders());

  const leftCol = { x: 22, y: 12, width: 72, height: 186 };

  // -------------------------------------------------------------
  // 1. SEÇÃO TRANSVERSAL (esquerda superior)
  // -------------------------------------------------------------
  const planBox = { x: leftCol.x, y: leftCol.y, width: leftCol.width, height: 68 };
  const planScale = selectBestScale(
    { width_m: D * 1.4, length_m: D * 1.4 },
    { x: planBox.x, y: planBox.y, width: planBox.width, height: planBox.height - 12 },
  );
  const planTransform = createModelToSheetTransform(
    { width_m: D * 1.4, length_m: D * 1.4 },
    { x: planBox.x, y: planBox.y + 6, width: planBox.width, height: planBox.height - 14 },
    planScale,
  );

  primitives.push({
    type: "text",
    text: fitTextToWidth(`SEÇÃO (${planScale.scaleLabel})`, 4.5, planBox.width - 4),
    x: planBox.x + planBox.width / 2,
    y: planBox.y + 3,
    fontSize: 4.5,
    align: "center",
    baseline: "middle",
    color: "#7A5820",
    bold: true,
  });

  const c0 = planTransform.toSheetPoint({ x: 0, y: 0 });
  const rOuter = (D / 2) * planTransform.scaleFactor;
  primitives.push({
    type: "circle",
    cx: c0.x,
    cy: c0.y,
    r: rOuter,
    strokeWidth: 0.6,
    strokeColor: "#000000",
    fillColor: "#e8eef5",
  });

  const cover_m = 0.05;
  const rBars = Math.max(0.02, D / 2 - cover_m) * planTransform.scaleFactor;
  for (let i = 0; i < nLong; i++) {
    const ang = (2 * Math.PI * i) / nLong - Math.PI / 2;
    primitives.push({
      type: "circle",
      cx: c0.x + rBars * Math.cos(ang),
      cy: c0.y + rBars * Math.sin(ang),
      r: 1.2,
      strokeWidth: 0.3,
      strokeColor: "#b30000",
      fillColor: "#b30000",
    });
  }

  primitives.push(
    ...createLinearDimension({
      start: { x: c0.x - rOuter, y: c0.y + rOuter + 3 },
      end: { x: c0.x + rOuter, y: c0.y + rOuter + 3 },
      offset_mm: 0,
      measurement_cm: Math.round(D * 100),
      orientation: "horizontal",
      fontSize: 3.8,
    }),
  );

  primitives.push({
    type: "text",
    text: fitTextToWidth(
      `${nLong} barras · D=${Math.round(D * 100)} cm`,
      3.8,
      planBox.width - 4,
    ),
    x: planBox.x + planBox.width / 2,
    y: planBox.y + planBox.height - 3,
    fontSize: 3.8,
    align: "center",
    baseline: "middle",
    color: "#333333",
  });

  // -------------------------------------------------------------
  // 2. CORTE LONGITUDINAL (esquerda inferior)
  // -------------------------------------------------------------
  const secBox = {
    x: leftCol.x,
    y: planBox.y + planBox.height + 2,
    width: leftCol.width,
    height: leftCol.height - planBox.height - 2,
  };
  const section = drawPileLongSection({
    box: { x: secBox.x, y: secBox.y + 5, width: secBox.width, height: secBox.height - 14 },
    diameter_m: D,
    length_m: L,
    cageLength_m: cageL,
    cover_m,
  });

  const longTitle = section.broken
    ? `CORTE (${section.scaleLabel.replace(/ c\/ quebra/i, "")}*)`
    : `CORTE (${section.scaleLabel})`;
  primitives.push({
    type: "text",
    text: fitTextToWidth(longTitle, 4.5, secBox.width - 4),
    x: secBox.x + secBox.width / 2,
    y: secBox.y + 3,
    fontSize: 4.5,
    align: "center",
    baseline: "middle",
    color: "#7A5820",
    bold: true,
  });
  primitives.push(...section.primitives);

  const footerNote =
    input.pileCount > 1
      ? `Tipica L=${L.toFixed(1)}m · Lg=${cageL.toFixed(1)}m · x${input.pileCount}`
      : `L=${L.toFixed(1)}m · Lgaiola=${cageL.toFixed(1)}m`;
  primitives.push({
    type: "text",
    text: fitTextToWidth(footerNote, 3.5, secBox.width - 4),
    x: secBox.x + secBox.width / 2,
    y: secBox.y + secBox.height - 3,
    fontSize: 3.5,
    align: "center",
    baseline: "middle",
    color: "#444444",
  });
  if (section.broken) {
    primitives.push({
      type: "text",
      text: "* escala c/ quebra",
      x: secBox.x + 1,
      y: secBox.y + secBox.height - 7,
      fontSize: 3.0,
      align: "left",
      baseline: "middle",
      color: "#888888",
    });
  }

  // -------------------------------------------------------------
  // 3. DESDOBRAMENTO (coluna central — sem invadir tabela)
  // -------------------------------------------------------------
  const rebarColBox = { x: 98, y: 10, width: 82, height: 190 };
  primitives.push({
    type: "rect",
    x: rebarColBox.x,
    y: rebarColBox.y,
    width: rebarColBox.width,
    height: rebarColBox.height,
    strokeWidth: 0.4,
    strokeColor: "#000000",
    fillColor: "#ffffff",
  });
  primitives.push({
    type: "rect",
    x: rebarColBox.x,
    y: rebarColBox.y,
    width: rebarColBox.width,
    height: 6,
    strokeWidth: 0.4,
    strokeColor: "#000000",
    fillColor: "#f0f4f8",
  });
  primitives.push({
    type: "text",
    text: fitTextToWidth("DESDOBRAMENTO", 5.0, rebarColBox.width - 4),
    x: rebarColBox.x + rebarColBox.width / 2,
    y: rebarColBox.y + 3,
    fontSize: 5.0,
    align: "center",
    baseline: "middle",
    color: "#7A5820",
    bold: true,
  });

  if (takeoff && takeoff.items.length > 0) {
    const shapes = extractRebarShapes(takeoff, {
      width_m: D,
      length_m: D,
      height_m: cageL,
      cover_m,
    });

    const availableH = rebarColBox.height - 10;
    const slotCount = Math.max(shapes.length, 1);
    const slotH = Math.min(40, Math.max(26, availableH / slotCount));

    shapes.forEach((shape, idx) => {
      const slotY = rebarColBox.y + 8 + idx * slotH;
      if (slotY + slotH <= rebarColBox.y + rebarColBox.height) {
        primitives.push(
          ...drawRebarShape(shape, {
            x: rebarColBox.x + 2,
            y: slotY,
            width: rebarColBox.width - 4,
            height: slotH - 2,
          }),
        );
        if (idx < shapes.length - 1) {
          primitives.push({
            type: "line",
            x1: rebarColBox.x + 4,
            y1: slotY + slotH - 1,
            x2: rebarColBox.x + rebarColBox.width - 4,
            y2: slotY + slotH - 1,
            strokeWidth: 0.2,
            strokeColor: "#e0e0e0",
          });
        }
      }
    });
  } else {
    primitives.push({
      type: "text",
      text: "Geometria da estaca à esquerda.",
      x: rebarColBox.x + rebarColBox.width / 2,
      y: rebarColBox.y + 24,
      fontSize: 4.2,
      align: "center",
      baseline: "middle",
      color: "#555555",
    });
  }

  // -------------------------------------------------------------
  // 4. TABELA + CARIMBO (direita)
  // -------------------------------------------------------------
  const tableBox = { x: 185, y: 10, width: 100, maxHeight: 128 };
  if (takeoff) {
    const table = drawRebarTable(takeoff, tableBox);
    primitives.push(...table.primitives);

    const summaryY = tableBox.y + table.totalHeight + 5;
    primitives.push({
      type: "text",
      text: fitTextToWidth(
        `CONCRETO: ${takeoff.concreteVolume_m3.toFixed(3)} m3/un · ${takeoff.concreteGrade}`,
        4.0,
        tableBox.width,
      ),
      x: tableBox.x,
      y: summaryY,
      fontSize: 4.0,
      align: "left",
      baseline: "middle",
      color: "#7A5820",
      bold: true,
    });
    if (input.pileCount > 1) {
      primitives.push({
        type: "text",
        text: fitTextToWidth(
          `Projeto x${input.pileCount}: ${(takeoff.concreteVolume_m3 * input.pileCount).toFixed(2)} m3 · ${(takeoff.totalSteelWithLosses_kg * input.pileCount).toFixed(1)} kg`,
          3.6,
          tableBox.width,
        ),
        x: tableBox.x,
        y: summaryY + 5.5,
        fontSize: 3.6,
        align: "left",
        baseline: "middle",
        color: "#333333",
      });
    }
  }

  const titleInfo: TitleBlockInfo = {
    ...input.titleInfo,
    scaleLabel: "VER DET.",
  };
  primitives.push(...drawTitleBlock(titleInfo, { x: 185, y: 152, width: 100, height: 48 }));

  return {
    width_mm: 297,
    height_mm: 210,
    title: input.titleInfo.drawingTitle,
    elementRef: input.titleInfo.elementRef,
    sheetNumber: input.titleInfo.sheetNumber,
    primitives,
  };
}
