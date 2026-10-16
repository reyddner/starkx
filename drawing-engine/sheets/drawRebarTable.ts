import type { DrawingPrimitive } from "../core/types";
import { fitFontSize, fitTextToWidth } from "../core/textFit";
import type { ElementTakeoff } from "../../structural-engine/takeoff/types";

export interface RebarTablePosition {
  x: number;
  y: number;
  width: number;
  /** Altura máxima disponível (mm). Excedente vira linha "+N posições". */
  maxHeight?: number;
}

/** Altura ≥ fonte + descendente — evita 'g' de "kg" cortado pela linha seguinte. */
const ROW_H = 5.2;
const HEADER_H = 5.5;
const BODY_FS = 3.8;
const CONCRETE_BLOCK_H = 4.5 + 2 * ROW_H;
const FIXED_H = HEADER_H + ROW_H + 3 * ROW_H + CONCRETE_BLOCK_H;

export function rebarTableItemCapacity(maxHeight: number): number {
  return Math.max(1, Math.floor((maxHeight - FIXED_H) / ROW_H));
}

export function drawRebarTable(
  takeoff: ElementTakeoff,
  pos: RebarTablePosition = { x: 187, y: 10, width: 100 },
): { primitives: DrawingPrimitive[]; totalHeight: number } {
  const { x, y, width } = pos;
  const primitives: DrawingPrimitive[] = [];

  const capacity =
    pos.maxHeight != null ? rebarTableItemCapacity(pos.maxHeight) : Number.POSITIVE_INFINITY;
  const shownItems =
    takeoff.items.length > capacity
      ? takeoff.items.slice(0, Math.max(1, capacity - 1))
      : takeoff.items;
  const omittedCount = takeoff.items.length - shownItems.length;

  // Colunas compactas — evita "Ø (mm)" colidir com "AÇO"
  const colWidths = [11, 16, 12, 11, 22, 28]; // 100
  const colX = [
    x,
    x + colWidths[0]!,
    x + colWidths[0]! + colWidths[1]!,
    x + colWidths[0]! + colWidths[1]! + colWidths[2]!,
    x + colWidths[0]! + colWidths[1]! + colWidths[2]! + colWidths[3]!,
    x + colWidths[0]! + colWidths[1]! + colWidths[2]! + colWidths[3]! + colWidths[4]!,
  ];

  let currentY = y;
  const rowH = ROW_H;
  const headerH = HEADER_H;

  primitives.push({
    type: "rect",
    x,
    y: currentY,
    width,
    height: headerH,
    strokeWidth: 0.5,
    strokeColor: "#000000",
    fillColor: "#f0f4f8",
  });

  const title = `RELAÇÃO DO AÇO — ${takeoff.elementRef}`;
  const titleFs = fitFontSize(title, 5.2, width - 4, 3.5);
  primitives.push({
    type: "text",
    text: fitTextToWidth(title, titleFs, width - 4),
    x: x + width / 2,
    y: currentY + headerH / 2,
    fontSize: titleFs,
    align: "center",
    baseline: "middle",
    color: "#7A5820",
    bold: true,
  });

  currentY += headerH;

  primitives.push({
    type: "rect",
    x,
    y: currentY,
    width,
    height: rowH,
    strokeWidth: 0.4,
    strokeColor: "#000000",
    fillColor: "#e6eef5",
  });

  const headers = ["POS", "AÇO", "DIAM", "QTD", "COMP", "PESO"];
  headers.forEach((h, i) => {
    const cw = colWidths[i]! - 1;
    const fs = fitFontSize(h, 4.2, cw, 3.2);
    primitives.push({
      type: "text",
      text: fitTextToWidth(h, fs, cw),
      x: colX[i]! + colWidths[i]! / 2,
      y: currentY + rowH / 2,
      fontSize: fs,
      align: "center",
      baseline: "middle",
      color: "#222222",
      bold: true,
    });
  });

  currentY += rowH;

  shownItems.forEach((item, index) => {
    primitives.push({
      type: "rect",
      x,
      y: currentY,
      width,
      height: rowH,
      strokeWidth: 0.25,
      strokeColor: "#cccccc",
      fillColor: index % 2 === 0 ? "#ffffff" : "#fbfcfd",
    });

    const values = [
      `N${index + 1}`,
      item.steelGrade,
      item.diameter_mm.toFixed(1).replace(".0", ""),
      String(item.count),
      String(Math.round(item.unitLength_m * 100)),
      item.totalWeight_kg.toFixed(2),
    ];

    values.forEach((val, i) => {
      const cw = colWidths[i]! - 2;
      const fs = fitFontSize(val, BODY_FS, cw, 3.0);
      primitives.push({
        type: "text",
        text: fitTextToWidth(val, fs, cw),
        x: colX[i]! + colWidths[i]! / 2,
        y: currentY + rowH / 2,
        fontSize: fs,
        align: "center",
        baseline: "middle",
        color: "#000000",
      });
    });

    currentY += rowH;
  });

  if (omittedCount > 0) {
    primitives.push({
      type: "rect",
      x,
      y: currentY,
      width,
      height: rowH,
      strokeWidth: 0.25,
      strokeColor: "#cccccc",
      fillColor: "#fff8e1",
    });
    primitives.push({
      type: "text",
      text: fitTextToWidth(`+${omittedCount} pos. — ver memorial`, 4.0, width - 4),
      x: x + width / 2,
      y: currentY + rowH / 2,
      fontSize: 4.0,
      align: "center",
      baseline: "middle",
      color: "#8a6d00",
    });
    currentY += rowH;
  }

  for (let i = 1; i < colX.length; i++) {
    primitives.push({
      type: "line",
      x1: colX[i],
      y1: y + headerH,
      x2: colX[i],
      y2: currentY,
      strokeWidth: 0.25,
      strokeColor: "#bbbbbb",
    });
  }

  const subtotalCA50 = takeoff.items
    .filter((i) => i.steelGrade === "CA-50")
    .reduce((sum, i) => sum + i.totalWeight_kg, 0);
  const subtotalCA60 = takeoff.items
    .filter((i) => i.steelGrade === "CA-60")
    .reduce((sum, i) => sum + i.totalWeight_kg, 0);

  const summaryRows = [
    { label: "Subtotal CA-50:", val: `${subtotalCA50.toFixed(2)} kg` },
    { label: "Subtotal CA-60:", val: `${subtotalCA60.toFixed(2)} kg` },
    {
      label: `Total (+${takeoff.lossPercentage}% perdas):`,
      val: `${takeoff.totalSteelWithLosses_kg.toFixed(2)} kg`,
      bold: true,
      color: "#7A5820",
    },
  ];

  summaryRows.forEach((r) => {
    primitives.push({
      type: "rect",
      x,
      y: currentY,
      width,
      height: rowH,
      strokeWidth: 0.3,
      strokeColor: "#aaaaaa",
      fillColor: "#f7f9fa",
    });
    const labelW = width * 0.58;
    const valW = width * 0.36;
    primitives.push({
      type: "text",
      text: fitTextToWidth(r.label, BODY_FS, labelW),
      x: x + 2.5,
      y: currentY + rowH / 2,
      fontSize: BODY_FS,
      align: "left",
      baseline: "middle",
      color: r.color || "#333333",
      bold: r.bold || false,
    });
    primitives.push({
      type: "text",
      text: fitTextToWidth(r.val, BODY_FS, valW),
      x: x + width - 3,
      y: currentY + rowH / 2,
      fontSize: BODY_FS,
      align: "right",
      baseline: "middle",
      color: r.color || "#000000",
      bold: r.bold || false,
    });
    currentY += rowH;
  });

  const concHeaderH = 4.5;
  primitives.push({
    type: "rect",
    x,
    y: currentY,
    width,
    height: concHeaderH,
    strokeWidth: 0.4,
    strokeColor: "#000000",
    fillColor: "#e6eef5",
  });
  primitives.push({
    type: "text",
    text: "VOLUMES DE CONCRETO",
    x: x + width / 2,
    y: currentY + concHeaderH / 2,
    fontSize: 4.5,
    align: "center",
    baseline: "middle",
    color: "#7A5820",
    bold: true,
  });
  currentY += concHeaderH;

  const concRows = [
    {
      label: `Estrutural (${takeoff.concreteGrade}):`,
      val: `${takeoff.concreteVolume_m3.toFixed(2)} m³`,
    },
    { label: "Magro:", val: `${takeoff.leanConcreteVolume_m3.toFixed(2)} m³` },
  ];

  concRows.forEach((c) => {
    primitives.push({
      type: "rect",
      x,
      y: currentY,
      width,
      height: rowH,
      strokeWidth: 0.25,
      strokeColor: "#cccccc",
      fillColor: "#ffffff",
    });
    primitives.push({
      type: "text",
      text: fitTextToWidth(c.label, BODY_FS, width * 0.58),
      x: x + 2.5,
      y: currentY + rowH / 2,
      fontSize: BODY_FS,
      align: "left",
      baseline: "middle",
      color: "#333333",
    });
    primitives.push({
      type: "text",
      text: fitTextToWidth(c.val, BODY_FS, width * 0.36),
      x: x + width - 3,
      y: currentY + rowH / 2,
      fontSize: BODY_FS,
      align: "right",
      baseline: "middle",
      color: "#000000",
      bold: true,
    });
    currentY += rowH;
  });

  primitives.push({
    type: "rect",
    x,
    y,
    width,
    height: currentY - y,
    strokeWidth: 0.6,
    strokeColor: "#000000",
  });

  return { primitives, totalHeight: currentY - y };
}
