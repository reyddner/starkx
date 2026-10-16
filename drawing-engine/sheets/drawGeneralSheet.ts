import type {
  A4Sheet,
  DrawingPrimitive,
  TitleBlockInfo,
} from "../core/types";
import { drawSheetBorders } from "./sheetBorders";
import { drawTitleBlock } from "./drawTitleBlock";
import { fitFontSize, fitTextToWidth, wrapTextToLines } from "../core/textFit";
import type { ProjectTakeoffSummary } from "../../structural-engine/takeoff/types";

export interface GeneralElementRow {
  elementRef: string;
  kind: string;
  dimensions: string;
  load_kN: number;
  sheetRef: string;
}

export interface GeneralSheetInput {
  titleInfo: TitleBlockInfo;
  elements: GeneralElementRow[];
  takeoffSummary?: ProjectTakeoffSummary;
  notes?: string[];
}

export function drawGeneralSheet(input: GeneralSheetInput): A4Sheet {
  const { titleInfo, elements, takeoffSummary } = input;
  const primitives: DrawingPrimitive[] = [];

  primitives.push(...drawSheetBorders());

  const headerBox = { x: 22, y: 12, width: 263, height: 22 };
  primitives.push({
    type: "rect",
    x: headerBox.x,
    y: headerBox.y,
    width: headerBox.width,
    height: headerBox.height,
    strokeWidth: 0.6,
    strokeColor: "#000000",
    fillColor: "#f7f9fa",
  });

  if (titleInfo.companyLogoBase64) {
    primitives.push({
      type: "image",
      dataUri: titleInfo.companyLogoBase64,
      x: headerBox.x + 3,
      y: headerBox.y + 3,
      width: 32,
      height: 16,
    });
  }

  const titleX = titleInfo.companyLogoBase64 ? headerBox.x + 40 : headerBox.x + 6;
  const titleMaxW = headerBox.x + headerBox.width - titleX - 4;
  const titleText = "CADERNO DE PRANCHAS — FUNDAÇÕES (ESQUEMÁTICO)";
  const titleFs = fitFontSize(titleText, 6.5, titleMaxW);
  primitives.push({
    type: "text",
    text: fitTextToWidth(titleText, titleFs, titleMaxW),
    x: titleX,
    y: headerBox.y + 5.5,
    fontSize: titleFs,
    align: "left",
    baseline: "middle",
    color: "#7A5820",
    bold: true,
  });
  const headerLines = [
    `OBRA: ${(titleInfo.projectName || "—").toUpperCase()}${titleInfo.projectCode ? `  (${titleInfo.projectCode})` : ""}`,
    `CLIENTE: ${titleInfo.client || "—"}   |   LOCAL: ${titleInfo.location || "—"}`,
  ];
  headerLines.forEach((line, i) => {
    const fs = fitFontSize(line, 4.4, titleMaxW, 3.5, false);
    primitives.push({
      type: "text",
      text: fitTextToWidth(line, fs, titleMaxW, false),
      x: titleX,
      y: headerBox.y + 12 + i * 6,
      fontSize: fs,
      align: "left",
      baseline: "middle",
      color: "#444444",
    });
  });

  const blockCount = elements.filter((e) => /bloco/i.test(e.kind) || /bloco/i.test(e.elementRef)).length;
  const pileCount = elements.filter((e) => /estaca/i.test(e.kind) || /estaca/i.test(e.elementRef)).length;
  const otherCount = elements.length - blockCount - pileCount;

  const tableBox = { x: 22, y: 38, width: 150, height: 0 };
  const thHeight = 5.2;
  const trHeight = 5.0;
  const maxTableH = 92;
  const neededH = thHeight + trHeight * (1 + elements.length);
  tableBox.height = Math.min(maxTableH, neededH);

  primitives.push({
    type: "rect",
    x: tableBox.x,
    y: tableBox.y,
    width: tableBox.width,
    height: thHeight,
    strokeWidth: 0.5,
    strokeColor: "#000000",
    fillColor: "#e6eef5",
  });

  const quadroTitle =
    blockCount > 0
      ? `QUADRO GERAL — ${blockCount} bloco(s)` +
        (pileCount > 0 ? ` + estaca típica` : "") +
        (otherCount > 0 ? ` + ${otherCount}` : "")
      : `QUADRO GERAL (${elements.length} item(ns))`;
  primitives.push({
    type: "text",
    text: fitTextToWidth(quadroTitle, 4.8, tableBox.width - 4),
    x: tableBox.x + tableBox.width / 2,
    y: tableBox.y + thHeight / 2,
    fontSize: 4.8,
    align: "center",
    baseline: "middle",
    color: "#7A5820",
    bold: true,
  });

  const tColW = [37, 38, 31, 19, 25];
  const tColX = [
    tableBox.x,
    tableBox.x + tColW[0]!,
    tableBox.x + tColW[0]! + tColW[1]!,
    tableBox.x + tColW[0]! + tColW[1]! + tColW[2]!,
    tableBox.x + tColW[0]! + tColW[1]! + tColW[2]! + tColW[3]!,
  ];

  const colHeaders = ["ELEMENTO", "TIPO", "DIMENSÕES", "N (kN)", "PRANCHA"];
  let curY = tableBox.y + thHeight;

  primitives.push({
    type: "rect",
    x: tableBox.x,
    y: curY,
    width: tableBox.width,
    height: trHeight,
    strokeWidth: 0.3,
    strokeColor: "#cccccc",
    fillColor: "#f0f4f8",
  });

  colHeaders.forEach((h, i) => {
    primitives.push({
      type: "text",
      text: h,
      x: tColX[i]! + tColW[i]! / 2,
      y: curY + trHeight / 2,
      fontSize: fitFontSize(h, 4.0, tColW[i]! - 1.5),
      align: "center",
      baseline: "middle",
      color: "#333333",
      bold: true,
    });
  });

  curY += trHeight;

  let omitted = 0;
  elements.forEach((el, index) => {
    if (curY + trHeight > tableBox.y + tableBox.height + 1e-6) {
      omitted++;
      return;
    }
    primitives.push({
      type: "rect",
      x: tableBox.x,
      y: curY,
      width: tableBox.width,
      height: trHeight,
      strokeWidth: 0.2,
      strokeColor: "#dddddd",
      fillColor: index % 2 === 0 ? "#ffffff" : "#fbfcfd",
    });

    const rowValues = [
      el.elementRef,
      el.kind,
      el.dimensions,
      el.load_kN > 0 ? el.load_kN.toFixed(0) : "—",
      el.sheetRef,
    ];

    rowValues.forEach((val, i) => {
      const colW = tColW[i]! - 1.5;
      const fs = fitFontSize(val, 4.0, colW, 3.5, false);
      primitives.push({
        type: "text",
        text: fitTextToWidth(val, fs, colW, false),
        x: tColX[i]! + tColW[i]! / 2,
        y: curY + trHeight / 2,
        fontSize: fs,
        align: "center",
        baseline: "middle",
        color: "#000000",
      });
    });

    curY += trHeight;
  });

  primitives.push({
    type: "rect",
    x: tableBox.x,
    y: tableBox.y,
    width: tableBox.width,
    height: curY - tableBox.y,
    strokeWidth: 0.5,
    strokeColor: "#000000",
  });

  if (omitted > 0) {
    primitives.push({
      type: "text",
      text: `… +${omitted} item(ns) listados nas pranchas`,
      x: tableBox.x + 2,
      y: curY + 3,
      fontSize: 3.8,
      align: "left",
      baseline: "middle",
      color: "#b30000",
    });
  }

  const notesTop = Math.max(132, curY + (omitted > 0 ? 8 : 6));
  const notesBox = { x: 22, y: notesTop, width: 150, height: 198 - notesTop };

  primitives.push({
    type: "rect",
    x: notesBox.x,
    y: notesBox.y,
    width: notesBox.width,
    height: notesBox.height,
    strokeWidth: 0.4,
    strokeColor: "#000000",
    fillColor: "#ffffff",
  });

  primitives.push({
    type: "text",
    text: "NOTAS / ESCOPO",
    x: notesBox.x + 3,
    y: notesBox.y + 4,
    fontSize: 4.8,
    align: "left",
    baseline: "middle",
    color: "#7A5820",
    bold: true,
  });

  const defaultNotes = [
    "Desenhos esquemáticos STARKX — não substituem prancha executiva nem ART.",
    "Cada pilar com carga tem a sua prancha; a estaca típica é compartilhada.",
    "Pilar não apoia no fuste: há bloco de coroamento (1E ou mais).",
    "STARKX — software livre (AGPL-3.0). Pré-dimensionamento: conferir antes de executar.",
  ];
  const notes = [...defaultNotes, ...(input.notes ?? [])];
  const noteMaxW = notesBox.width - 9;
  const notesBottom = notesBox.y + notesBox.height - 2.5;
  // Corpo único para todas as notas: o maior que faça todas caberem na caixa.
  let noteFs = 3.8;
  const linesFor = (fs: number) =>
    notes.map((n) => wrapTextToLines(n, fs, noteMaxW, 3, false));
  let wrapped = linesFor(noteFs);
  const heightFor = (w: string[][], fs: number) =>
    w.reduce((h, l) => h + l.length * (fs + 0.9) + 0.6, 0);
  while (noteFs > 3.5 && notesBox.y + 9 + heightFor(wrapped, noteFs) > notesBottom) {
    noteFs = Number((noteFs - 0.1).toFixed(1));
    wrapped = linesFor(noteFs);
  }
  let ny = notesBox.y + 9.5;
  for (const lines of wrapped) {
    if (ny + noteFs * 0.4 > notesBottom) break;
    lines.forEach((line, i) => {
      if (ny + noteFs * 0.4 > notesBottom) return;
      primitives.push({
        type: "text",
        text: i === 0 ? `• ${line}` : line,
        x: notesBox.x + (i === 0 ? 3 : 6),
        y: ny,
        fontSize: noteFs,
        align: "left",
        baseline: "middle",
        color: "#333333",
      });
      ny += noteFs + 0.9;
    });
    ny += 0.6;
  }

  const qtyBox = { x: 177, y: 38, width: 108, height: 108 };
  primitives.push({
    type: "rect",
    x: qtyBox.x,
    y: qtyBox.y,
    width: qtyBox.width,
    height: qtyBox.height,
    strokeWidth: 0.4,
    strokeColor: "#000000",
    fillColor: "#ffffff",
  });
  primitives.push({
    type: "text",
    text: "RESUMO DE MEDIÇÃO",
    x: qtyBox.x + qtyBox.width / 2,
    y: qtyBox.y + 5,
    fontSize: 5.2,
    align: "center",
    baseline: "middle",
    color: "#7A5820",
    bold: true,
  });

  let qy = qtyBox.y + 12;
  if (takeoffSummary) {
    const lines = [
      `Aço CA-50: ${takeoffSummary.totalCA50_kg.toFixed(1)} kg`,
      `Aço CA-60: ${takeoffSummary.totalCA60_kg.toFixed(1)} kg`,
      `Aço total (+${takeoffSummary.lossPercentage}%): ${takeoffSummary.totalSteel_kg.toFixed(1)} kg`,
      `Magro: ${takeoffSummary.totalLeanConcrete_m3.toFixed(2)} m³`,
      ...Object.entries(takeoffSummary.concreteByGrade_m3).map(
        ([g, v]) => `Concreto ${g}: ${v.toFixed(2)} m³`,
      ),
    ];
    for (const line of lines) {
      if (qy > qtyBox.y + qtyBox.height - 4) break;
      primitives.push({
        type: "text",
        text: fitTextToWidth(line, 4.2, qtyBox.width - 8),
        x: qtyBox.x + 4,
        y: qy,
        fontSize: 4.2,
        align: "left",
        baseline: "middle",
        color: "#000000",
      });
      qy += 5.2;
    }
  } else {
    primitives.push({
      type: "text",
      text: "Quantitativo indisponível.",
      x: qtyBox.x + 4,
      y: qy,
      fontSize: 4.2,
      align: "left",
      baseline: "middle",
      color: "#666666",
    });
  }

  primitives.push(
    ...drawTitleBlock({
      ...titleInfo,
      drawingTitle: "FOLHA DE ROSTO",
      scaleLabel: "VER DET.",
    }),
  );

  return {
    title: "Folha de Rosto e Quadro Geral",
    elementRef: "GERAL",
    sheetNumber: titleInfo.sheetNumber,
    width_mm: 297,
    height_mm: 210,
    primitives,
  };
}
