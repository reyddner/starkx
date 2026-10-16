/**
 * Serializa MemorialDocument → PDF (pdf-lib). Sem recálculo — DEC-26.
 */

import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { MemorialDocument, MemorialSection, MemorialTable } from "./types";

export interface MemorialPdfOptions {
  /** Bytes TTF/OTF com glyphs latinos (ex.: Roboto-Regular). */
  fontBytes: Uint8Array;
  /** Margem (pt); default 48 */
  marginPt?: number;
  fontSizeBody?: number;
  fontSizeTitle?: number;
  fontSizeHeading?: number;
}

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;

// Paleta STARKX: bronze para títulos e filetes, grafite para texto.
const BRAND_BRONZE = rgb(0x7a / 255, 0x58 / 255, 0x20 / 255);
const BRAND_GRAFITE = rgb(0x2f / 255, 0x2f / 255, 0x30 / 255);

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = words[0]!;
  for (let i = 1; i < words.length; i++) {
    const w = words[i]!;
    const trial = `${current} ${w}`;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
      current = trial;
    } else {
      lines.push(current);
      current = w;
    }
  }
  lines.push(current);
  return lines;
}

function drawWrapped(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  color = BRAND_GRAFITE,
): number {
  const lines = wrapText(text, font, size, maxWidth);
  let cursor = y;
  for (const line of lines) {
    page.drawText(line, { x, y: cursor, size, font, color });
    cursor -= lineHeight;
  }
  return cursor;
}

/**
 * Gera PDF A4 do memorial. Requer fonte embutida (Unicode pt-BR).
 */
export async function memorialToPdf(
  doc: MemorialDocument,
  opts: MemorialPdfOptions,
): Promise<Uint8Array> {
  const margin = opts.marginPt ?? 48;
  const sizeBody = opts.fontSizeBody ?? 10;
  const sizeTitle = opts.fontSizeTitle ?? 16;
  const sizeHeading = opts.fontSizeHeading ?? 12;
  const contentW = PAGE_W - margin * 2;
  const lineBody = sizeBody * 1.35;
  const lineHead = sizeHeading * 1.4;

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(opts.fontBytes, { subset: true });

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - margin;

  const ensureSpace = (need: number) => {
    if (y - need < margin) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - margin;
    }
  };

  ensureSpace(sizeTitle * 3);
  y = drawWrapped(page, doc.title, font, sizeTitle, margin, y, contentW, sizeTitle * 1.25, BRAND_BRONZE);
  y -= 4;
  y = drawWrapped(
    page,
    doc.subtitle,
    font,
    sizeBody,
    margin,
    y,
    contentW,
    lineBody,
    rgb(0.35, 0.35, 0.4),
  );
  y -= 12;

  const drawSection = (s: MemorialSection) => {
    ensureSpace(lineHead * 2 + lineBody * 2);
    page.drawLine({
      start: { x: margin, y: y + 4 },
      end: { x: PAGE_W - margin, y: y + 4 },
      thickness: 0.8,
      color: BRAND_BRONZE,
    });
    // `y` é linha de base: desce o corpo do título para o filete ficar acima das maiúsculas.
    y -= sizeHeading * 0.9 + 2;
    y = drawWrapped(page, s.title, font, sizeHeading, margin, y, contentW, lineHead, BRAND_BRONZE);
    y -= 4;

    for (const p of s.paragraphs) {
      ensureSpace(lineBody * 3);
      y = drawWrapped(page, p, font, sizeBody, margin, y, contentW, lineBody);
      y -= 4;
    }

    const drawTable = (t: MemorialTable) => {
      if (t.headers.length === 0) return;
      if (t.title) {
        ensureSpace(lineHead + 4);
        y = drawWrapped(page, t.title, font, sizeBody, margin, y, contentW, lineBody, BRAND_BRONZE);
        y -= 2;
      }
      const cols = t.headers.length;
      const colW = contentW / cols;
      const rowH = lineBody + 4;

      const drawRow = (cells: string[], header: boolean) => {
        ensureSpace(rowH + 2);
        let x = margin;
        for (let i = 0; i < cols; i++) {
          const raw = cells[i] ?? "";
          const cell = wrapText(raw, font, sizeBody - 1, colW - 6)[0] ?? "";
          page.drawText(cell, {
            x: x + 3,
            y: y - sizeBody + 2,
            size: sizeBody - (header ? 0 : 1),
            font,
            color: BRAND_GRAFITE,
          });
          x += colW;
        }
        y -= rowH;
      };

      drawRow(t.headers, true);
      page.drawLine({
        start: { x: margin, y: y + 2 },
        end: { x: PAGE_W - margin, y: y + 2 },
        thickness: 0.6,
        color: BRAND_BRONZE,
      });
      for (const row of t.rows) {
        drawRow(row, false);
      }
      y -= 8;
    };

    if (s.table) {
      drawTable(s.table);
    }
    if (s.tables) {
      for (const t of s.tables) {
        drawTable(t);
      }
    }

    y -= 8;
  };

  for (const section of doc.sections) {
    drawSection(section);
  }

  ensureSpace(lineBody * 2);
  y = drawWrapped(
    page,
    "STARKX — memorial gerado automaticamente (sem recalcular). Não substitui ART do RT.",
    font,
    8,
    margin,
    y,
    contentW,
    10,
    rgb(0.45, 0.45, 0.5),
  );

  return pdf.save();
}
