import type {
  A4Sheet,
  DrawingPrimitive,
  TitleBlockInfo,
} from "../core/types";
import { drawSheetBorders } from "./sheetBorders";
import { drawTitleBlock } from "./drawTitleBlock";
import { fitFontSize, fitTextToWidth } from "../core/textFit";
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

/** Quebra texto em linhas que cabem em maxWidthMm. */
function wrapLines(text: string, fontSizeMm: number, maxWidthMm: number, maxLines = 4): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (estimateWidth(trial, fontSizeMm) <= maxWidthMm) {
      cur = trial;
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (cur && lines.length < maxLines) {
    lines.push(fitTextToWidth(cur, fontSizeMm, maxWidthMm));
  }
  return lines;
}

function estimateWidth(text: string, fontSizeMm: number): number {
  return text.length * fontSizeMm * 0.55;
}

export function drawGeneralSheet(input: GeneralSheetInput): A4Sheet {
  const { titleInfo, elements, takeoffSummary } = input;
  const primitives: DrawingPrimitive[] = [];

  primitives.push(...drawSheetBorders());

  const headerBox = { x: 22, y: 12, width: 263, height: 18 };
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
      y: headerBox.y + 2,
      width: 32,
      height: 14,
    });
  }

  const titleX = titleInfo.companyLogoBase64 ? headerBox.x + 40 : headerBox.x + 6;
  const titleMaxW = headerBox.x + headerBox.width - titleX - 4;
  primitives.push({
    type: "text",
    text: fitTextToWidth("CADERNO DE PRANCHAS — FUNDAÇÕES (ESQUEMÁTICO)", 6.5, titleMaxW),
    x: titleX,
    y: headerBox.y + 5.5,
    fontSize: 6.5,
    align: "left",
    baseline: "middle",
    color: "#7A5820",
    bold: true,
  });
  primitives.push({
    type: "text",
    text: fitTextToWidth(
      `OBRA: ${(titleInfo.projectName || "—").toUpperCase()}  |  CLIENTE: ${titleInfo.client || "—"}  |  LOCAL: ${titleInfo.location || "—"}`,
      4.8,
      titleMaxW,
    ),
    x: titleX,
    y: headerBox.y + 12.5,
    fontSize: 4.8,
    align: "left",
    baseline: "middle",
    color: "#444444",
  });

  const blockCount = elements.filter((e) => /bloco/i.test(e.kind) || /bloco/i.test(e.elementRef)).length;
  const pileCount = elements.filter((e) => /estaca/i.test(e.kind) || /estaca/i.test(e.elementRef)).length;
  const otherCount = elements.length - blockCount - pileCount;

  const tableBox = { x: 22, y: 34, width: 145, height: 0 };
  const thHeight = 5.2;
  const trHeight = Math.min(4.5, Math.max(3.5, 68 / Math.max(6, elements.length + 2)));
  const maxTableH = 88;
  const neededH = thHeight + trHeight * (1 + Math.min(elements.length, 16));
  tableBox.height = Math.min(maxTableH, Math.max(26, neededH));

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
    text: fitTextToWidth(quadroTitle, 5.2, tableBox.width - 4),
    x: tableBox.x + tableBox.width / 2,
    y: tableBox.y + thHeight / 2,
    fontSize: 5.2,
    align: "center",
    baseline: "middle",
    color: "#7A5820",
    bold: true,
  });

  const tColW = [28, 36, 36, 22, 23];
  const tColX = [
    tableBox.x,
    tableBox.x + tColW[0]!,
    tableBox.x + tColW[0]! + tColW[1]!,
    tableBox.x + tColW[0]! + tColW[1]! + tColW[2]!,
    tableBox.x + tColW[0]! + tColW[1]! + tColW[2]! + tColW[3]!,
  ];

  const colHeaders = ["ELEMENTO", "TIPO", "DIMENSÕES", "Nk", "PRANCHA"];
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
      fontSize: 4.0,
      align: "center",
      baseline: "middle",
      color: "#333333",
      bold: true,
    });
  });

  curY += trHeight;

  let omitted = 0;
  elements.forEach((el, index) => {
    if (curY + trHeight > tableBox.y + tableBox.height - 0.5) {
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
      const colW = tColW[i]! - 1.2;
      const fs = fitFontSize(val, 4.0, colW, 3.0);
      primitives.push({
        type: "text",
        text: fitTextToWidth(val, fs, colW),
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

  const notesTop = Math.max(118, curY + (omitted > 0 ? 8 : 6));
  const notesBox = {
    x: 22,
    y: notesTop,
    width: 145,
    height: Math.max(18, 150 - notesTop),
  };
  // Carimbo começa ~152; notas não podem invadir.
  notesBox.height = Math.min(notesBox.height, 150 - notesBox.y);

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
    y: notesBox.y + 3.5,
    fontSize: 4.8,
    align: "left",
    baseline: "middle",
    color: "#7A5820",
    bold: true,
  });

  const defaultNotes = [
    "Desenhos esquemáticos STARKX — não substituem prancha executiva nem ART.",
    "Cada pilar com carga tem prancha de bloco; estaca típica é compartilhada.",
    "Pilar não apoia no fuste: há bloco de coroamento (1E ou mais).",
    "STARKX — software livre (AGPL-3.0). Pré-dimensionamento: conferir antes de executar.",
  ];
  const notes = [...defaultNotes, ...(input.notes ?? [])];
  let ny = notesBox.y + 8;
  const noteFs = 3.8;
  const noteMaxW = notesBox.width - 6;
  for (const note of notes) {
    const lines = wrapLines(`• ${note}`, noteFs, noteMaxW, 3);
    for (const line of lines) {
      if (ny > notesBox.y + notesBox.height - 3) break;
      primitives.push({
        type: "text",
        text: line,
        x: notesBox.x + 3,
        y: ny,
        fontSize: noteFs,
        align: "left",
        baseline: "middle",
        color: "#333333",
      });
      ny += 4.2;
    }
    if (ny > notesBox.y + notesBox.height - 3) break;
  }

  const qtyBox = { x: 172, y: 34, width: 113, height: 108 };
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
