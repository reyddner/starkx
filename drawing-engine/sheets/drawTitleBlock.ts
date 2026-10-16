import type {
  DrawingPrimitive,
  ImagePrimitive,
  TitleBlockInfo,
} from "../core/types";
import { fitFontSize, fitTextToWidth, wrapTextToLines } from "../core/textFit";

export interface TitleBlockPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Carimbo técnico A4 — tipografia compacta para caber no retângulo sem
 * sobrepor linhas nem vazar para fora da caixa.
 */
export function drawTitleBlock(
  info: TitleBlockInfo,
  pos: TitleBlockPosition = { x: 187, y: 155, width: 100, height: 45 },
): DrawingPrimitive[] {
  const { x, y, width, height } = pos;
  const primitives: DrawingPrimitive[] = [];
  const pad = 1.8;
  const innerW = width - 2 * pad;

  primitives.push({
    type: "rect",
    x,
    y,
    width,
    height,
    strokeWidth: 0.7,
    strokeColor: "#000000",
    fillColor: "#ffffff",
  });

  // Faixas: logo 10 | obra/cliente 11 | título/elemento 11 | rodapé resto
  const logoH = 10;
  const projH = 11;
  const drawH = 11;
  const footH = height - logoH - projH - drawH;

  const y1 = y + logoH;
  const y2 = y1 + projH;
  const y3 = y2 + drawH;

  for (const yy of [y1, y2, y3]) {
    primitives.push({
      type: "line",
      x1: x,
      y1: yy,
      x2: x + width,
      y2: yy,
      strokeWidth: 0.35,
      strokeColor: "#000000",
    });
  }

  // --- Logo / responsável ---
  if (info.companyLogoBase64) {
    const imgW = Math.min(28, width * 0.32);
    const img: ImagePrimitive = {
      type: "image",
      dataUri: info.companyLogoBase64,
      x: x + pad,
      y: y + 1.2,
      width: imgW,
      height: logoH - 2.4,
    };
    primitives.push(img);
    const name = (info.engineerName || "PROJETO ESTRUTURAL").toUpperCase();
    const nameFs = fitFontSize(name, 4.8, innerW - imgW - 2, 3.2);
    primitives.push({
      type: "text",
      text: fitTextToWidth(name, nameFs, innerW - imgW - 2),
      x: x + pad + imgW + 2,
      y: y + logoH / 2,
      fontSize: nameFs,
      align: "left",
      baseline: "middle",
      color: "#000000",
      bold: true,
    });
  } else {
    const name = (info.engineerName || "PROJETO ESTRUTURAL DE FUNDAÇÕES").toUpperCase();
    const nameFs = fitFontSize(name, 5.0, innerW, 3.2);
    primitives.push({
      type: "text",
      text: fitTextToWidth(name, nameFs, innerW),
      x: x + width / 2,
      y: info.crea ? y + 3.5 : y + logoH / 2,
      fontSize: nameFs,
      align: "center",
      baseline: "middle",
      color: "#7A5820",
      bold: true,
    });
    if (info.crea) {
      primitives.push({
        type: "text",
        text: fitTextToWidth(`CREA ${info.crea}`, 3.6, innerW),
        x: x + width / 2,
        y: y + logoH - 2.2,
        fontSize: 3.6,
        align: "center",
        baseline: "middle",
        color: "#555555",
      });
    }
  }

  // --- Obra / cliente (2 linhas, sem colisão) ---
  const obraFs = 4.0;
  const obraLines = wrapTextToLines(
    `OBRA: ${info.projectName}${info.projectCode ? ` (${info.projectCode})` : ""}`,
    obraFs,
    innerW,
    1,
  );
  primitives.push({
    type: "text",
    text: obraLines[0] ?? "",
    x: x + pad,
    y: y1 + 3.5,
    fontSize: obraFs,
    align: "left",
    baseline: "middle",
    color: "#000000",
    bold: true,
  });

  const clientFs = 3.6;
  const clientLine = wrapTextToLines(
    `CLIENTE: ${info.client || "—"}`,
    clientFs,
    innerW,
    1,
  )[0] ?? "";
  primitives.push({
    type: "text",
    text: clientLine,
    x: x + pad,
    y: y1 + 8.0,
    fontSize: clientFs,
    align: "left",
    baseline: "middle",
    color: "#444444",
  });

  // --- Título do desenho / elemento (títulos curtos + wrap) ---
  const titleFs = 4.0;
  const titleLines = wrapTextToLines(
    info.drawingTitle.toUpperCase(),
    titleFs,
    innerW,
    1,
  );
  primitives.push({
    type: "text",
    text: titleLines[0] ?? "",
    x: x + pad,
    y: y2 + 3.5,
    fontSize: titleFs,
    align: "left",
    baseline: "middle",
    color: "#7A5820",
    bold: true,
  });
  primitives.push({
    type: "text",
    text: fitTextToWidth(`ELEMENTO: ${info.elementRef}`, 3.8, innerW),
    x: x + pad,
    y: y2 + 8.0,
    fontSize: 3.8,
    align: "left",
    baseline: "middle",
    color: "#000000",
    bold: true,
  });

  // --- Rodapé: escala | data | prancha ---
  const col1W = 30;
  const col2W = 34;
  const col3W = width - col1W - col2W;

  primitives.push(
    {
      type: "line",
      x1: x + col1W,
      y1: y3,
      x2: x + col1W,
      y2: y + height,
      strokeWidth: 0.3,
      strokeColor: "#000000",
    },
    {
      type: "line",
      x1: x + col1W + col2W,
      y1: y3,
      x2: x + col1W + col2W,
      y2: y + height,
      strokeWidth: 0.3,
      strokeColor: "#000000",
    },
  );

  const labelY = y3 + footH * 0.32;
  const valueY = y3 + footH * 0.72;

  const scaleRaw = info.scaleLabel
    .replace(/S$/i, "")
    .replace(/INDICADAS?/i, "VER DET.")
    .trim();

  const cells: Array<{ cx: number; w: number; label: string; value: string; valueColor?: string }> = [
    {
      cx: x + col1W / 2,
      w: col1W - 2,
      label: "ESCALA",
      value: scaleRaw || "VER DET.",
    },
    { cx: x + col1W + col2W / 2, w: col2W - 2, label: "DATA", value: info.date },
    {
      cx: x + col1W + col2W + col3W / 2,
      w: col3W - 2,
      label: "PRANCHA",
      value: `${String(info.sheetNumber).padStart(2, "0")} / ${String(info.totalSheets).padStart(2, "0")}`,
      valueColor: "#b30000",
    },
  ];

  for (const cell of cells) {
    primitives.push({
      type: "text",
      text: cell.label,
      x: cell.cx,
      y: labelY,
      fontSize: 3.5,
      align: "center",
      baseline: "middle",
      color: "#666666",
    });
    const vfs = fitFontSize(cell.value, 4.8, cell.w, 3.2);
    primitives.push({
      type: "text",
      text: fitTextToWidth(cell.value, vfs, cell.w),
      x: cell.cx,
      y: valueY,
      fontSize: vfs,
      align: "center",
      baseline: "middle",
      color: cell.valueColor ?? "#000000",
      bold: true,
    });
  }

  return primitives;
}
