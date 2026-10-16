/**
 * Conferência de diagramação das pranchas: caixa de cada texto (mesmas métricas
 * Helvetica do PDF exportado), texto fora da moldura, texto sobre texto e
 * altura mínima de letra.
 */
import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";
import type { A4Sheet, TextPrimitive } from "../../drawing-engine/core/types";
import { A4_LANDSCAPE } from "../../drawing-engine/sheets/sheetBorders";
import { estimateTextWidthMm, MIN_FONT_MM, TEXT_METRICS } from "../../drawing-engine/core/textFit";

export interface TextBox {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  fontSize: number;
}

let fonts: { regular: PDFFont; bold: PDFFont } | null = null;

export async function loadFonts() {
  if (fonts) return fonts;
  const doc = await PDFDocument.create();
  fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  return fonts;
}

/** Mesma higienização WinAnsi do pdfExport (texto que some no PDF não conta). */
function printable(raw: string): string {
  return raw
    .replace(/…/g, "...")
    .replace(/—/g, " - ")
    .replace(/–/g, "-")
    .replace(/•/g, "*")
    .replace(/·/g, ".")
    .replace(/[φϕ]/g, "fi")
    .replace(/[Ø⌀]/g, "D")
    .replace(/³/g, "3")
    .replace(/²/g, "2")
    .replace(/[^\x00-\xFF]/g, "");
}

export function textBox(p: TextPrimitive): TextBox {
  // Largura impressa (o PDF não aplica kerning; o widthOfTextAtSize do pdf-lib aplica).
  const w = estimateTextWidthMm(p.text, p.fontSize, p.bold === true);
  const x0 = p.align === "center" ? p.x - w / 2 : p.align === "right" ? p.x - w : p.x;
  const baseline = p.y + TEXT_METRICS.baselineOffset(p.baseline) * p.fontSize;
  return {
    text: p.text,
    x0,
    x1: x0 + w,
    // Caixa das maiúsculas + descendente curto (o que de fato colide visualmente).
    y0: baseline - TEXT_METRICS.capHeight * p.fontSize,
    y1: baseline + 0.12 * p.fontSize,
    fontSize: p.fontSize,
  };
}

export interface LayoutIssue {
  kind: "fora-da-moldura" | "sobreposicao" | "letra-pequena";
  detail: string;
}

export function checkSheetLayout(sheet: A4Sheet): LayoutIssue[] {
  const dims = A4_LANDSCAPE;
  const fx0 = dims.marginLeft_mm;
  const fy0 = dims.marginTop_mm;
  const fx1 = fx0 + dims.printableWidth_mm;
  const fy1 = fy0 + dims.printableHeight_mm;
  const issues: LayoutIssue[] = [];
  const boxes = sheet.primitives
    .filter((p): p is TextPrimitive => p.type === "text" && printable(p.text).trim() !== "")
    .map((p) => textBox(p));

  for (const b of boxes) {
    if (b.fontSize < MIN_FONT_MM - 1e-6) {
      issues.push({ kind: "letra-pequena", detail: `"${b.text}" ${b.fontSize.toFixed(2)} mm` });
    }
    if (b.x0 < fx0 + 0.3 || b.x1 > fx1 - 0.3 || b.y0 < fy0 + 0.3 || b.y1 > fy1 - 0.3) {
      issues.push({
        kind: "fora-da-moldura",
        detail: `"${b.text}" x=${b.x0.toFixed(1)}..${b.x1.toFixed(1)} y=${b.y0.toFixed(1)}..${b.y1.toFixed(1)}`,
      });
    }
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (ox > 0.2 && oy > 0.2) {
        issues.push({ kind: "sobreposicao", detail: `"${a.text}" × "${b.text}"` });
      }
    }
  }
  return issues;
}
