import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { A4Sheet, DrawingProjectBook } from "../core/types";

const MM_TO_PT = 72 / 25.4; // ~2.834645669
const SHEET_WIDTH_PT = 297 * MM_TO_PT; // ~841.89 pt
const SHEET_HEIGHT_PT = 210 * MM_TO_PT; // ~595.28 pt

function hexToRgb(hex?: string) {
  if (!hex || hex === "none") return undefined;
  const clean = hex.replace("#", "");
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) / 255;
    const g = parseInt(clean[1] + clean[1], 16) / 255;
    const b = parseInt(clean[2] + clean[2], 16) / 255;
    return rgb(r, g, b);
  }
  if (clean.length >= 6) {
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    return rgb(r, g, b);
  }
  return rgb(0, 0, 0);
}

/**
 * Sanitiza textos para compatibilidade estrita com a codificação WinAnsi do Helvetica.
 */
function sanitizeText(raw: string): string {
  return raw
    .replace(/—/g, " - ")
    .replace(/–/g, "-")
    .replace(/•/g, "*")
    .replace(/·/g, ".")
    .replace(/∇/g, "Nivel ")
    .replace(/[φϕ]/g, "fi")
    .replace(/[Ø⌀]/g, "D")
    .replace(/³/g, "3")
    .replace(/²/g, "2")
    .replace(/[^\x00-\xFF]/g, ""); // Remove quaisquer caracteres fora da tabela latin-1
}

function decodeBase64(base64: string): Uint8Array {
  const g = globalThis as unknown as { Buffer?: { from: (str: string, enc: string) => Uint8Array } };
  if (typeof g.Buffer !== "undefined") {
    return new Uint8Array(g.Buffer.from(base64, "base64"));
  }
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/** Espessura de traço: mm do modelo → pt. Zero permanece zero (máscaras). */
function strokeToPt(strokeWidth_mm?: number): number {
  if (strokeWidth_mm === 0) return 0;
  return Math.max(0.25, (strokeWidth_mm ?? 0.35) * MM_TO_PT);
}

/** Tracejado em mm → pt (aceita `dashPattern` ou `dash`). */
function dashToPt(pattern?: number[]): number[] | undefined {
  if (!pattern || pattern.length === 0) return undefined;
  return pattern.map((v) => v * MM_TO_PT);
}

/**
 * Renderiza uma folha A4 técnica em uma página PDF vetorial de alta precisão.
 */
async function renderSheetToPdfPage(
  pdfDoc: PDFDocument,
  sheet: A4Sheet,
  regularFont: PDFFont,
  boldFont: PDFFont,
): Promise<PDFPage> {
  const page = pdfDoc.addPage([SHEET_WIDTH_PT, SHEET_HEIGHT_PT]);

  for (const p of sheet.primitives) {
    if (p.type === "line") {
      const x1 = p.x1 * MM_TO_PT;
      const y1 = (210 - p.y1) * MM_TO_PT;
      const x2 = p.x2 * MM_TO_PT;
      const y2 = (210 - p.y2) * MM_TO_PT;
      const color = hexToRgb(p.strokeColor) ?? rgb(0, 0, 0);

      page.drawLine({
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
        thickness: strokeToPt(p.strokeWidth),
        color,
        dashArray: dashToPt(p.dashPattern ?? p.dash),
      });
    } else if (p.type === "rect") {
      const x = p.x * MM_TO_PT;
      const y = (210 - (p.y + p.height)) * MM_TO_PT;
      const width = p.width * MM_TO_PT;
      const height = p.height * MM_TO_PT;
      const strokeColor = hexToRgb(p.strokeColor);
      const fillColor = hexToRgb(p.fillColor);

      page.drawRectangle({
        x,
        y,
        width,
        height,
        color: fillColor,
        borderColor: strokeColor,
        borderWidth: strokeColor ? strokeToPt(p.strokeWidth) : 0,
        borderDashArray: dashToPt(p.dashPattern),
      });
    } else if (p.type === "circle") {
      const cx = p.cx * MM_TO_PT;
      const cy = (210 - p.cy) * MM_TO_PT;
      const r = p.r * MM_TO_PT;
      const strokeColor = hexToRgb(p.strokeColor);
      const fillColor = hexToRgb(p.fillColor);

      page.drawCircle({
        x: cx,
        y: cy,
        size: r,
        color: fillColor,
        borderColor: strokeColor,
        borderWidth: strokeColor ? strokeToPt(p.strokeWidth) : 0,
      });
    } else if (p.type === "text") {
      const font = p.bold ? boldFont : regularFont;
      const text = sanitizeText(p.text);
      if (!text) continue;

      const sizePt = Math.max(5, p.fontSize * MM_TO_PT);
      const textWidth = font.widthOfTextAtSize(text, sizePt);
      const textHeight = font.heightAtSize(sizePt);

      let x = p.x * MM_TO_PT;
      let y = (210 - p.y) * MM_TO_PT - textHeight * 0.8; // alinhamento top default

      if (p.align === "center") {
        x -= textWidth / 2;
      } else if (p.align === "right") {
        x -= textWidth;
      }

      if (p.baseline === "middle") {
        y += textHeight * 0.35;
      } else if (p.baseline === "bottom") {
        y += textHeight * 0.75;
      }

      const color = hexToRgb(p.color) ?? rgb(0, 0, 0);

      page.drawText(text, {
        x,
        y,
        size: sizePt,
        font,
        color,
      });
    } else if (p.type === "image") {
      try {
        const x = p.x * MM_TO_PT;
        const y = (210 - (p.y + p.height)) * MM_TO_PT;
        const width = p.width * MM_TO_PT;
        const height = p.height * MM_TO_PT;

        const match = p.dataUri.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
        if (match) {
          const format = match[1]!.toLowerCase();
          const base64Data = match[2]!;
          const bytes = decodeBase64(base64Data);

          let embeddedImg;
          if (format.includes("png")) {
            embeddedImg = await pdfDoc.embedPng(bytes);
          } else {
            embeddedImg = await pdfDoc.embedJpg(bytes);
          }

          page.drawImage(embeddedImg, {
            x,
            y,
            width,
            height,
          });
        }
      } catch (err) {
        // Degradação elegante se a imagem não puder ser decodificada
        console.warn("Falha ao incorporar logotipo no PDF executivo:", err);
      }
    }
  }

  return page;
}

/**
 * Exporta o Caderno Completo de Pranchas Executivas para um Buffer Uint8Array de PDF.
 */
export async function exportProjectBookToPdf(book: DrawingProjectBook): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  // Incorpora fontes padrão Helvetica da ABNT
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (const sheet of book.sheets) {
    await renderSheetToPdfPage(pdfDoc, sheet, regularFont, boldFont);
  }

  return await pdfDoc.save();
}

/**
 * Exporta uma única folha A4 técnica para um Buffer Uint8Array de PDF.
 */
export async function exportSingleSheetToPdf(sheet: A4Sheet): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  await renderSheetToPdfPage(pdfDoc, sheet, regularFont, boldFont);

  return await pdfDoc.save();
}
