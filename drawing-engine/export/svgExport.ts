import type { A4Sheet } from "../core/types";
import { TEXT_METRICS } from "../core/textFit";

function dashAttr(pattern?: number[]): string {
  if (!pattern || pattern.length === 0) return "";
  return `stroke-dasharray="${pattern.join(" ")}"`;
}

/**
 * Converte uma folha A4 técnica (297 x 210 mm) em marcação SVG pura e vetorial.
 * O viewBox está em milímetros; `fontSize` das primitivas também é mm.
 */
export function exportSheetToSvg(sheet: A4Sheet): string {
  const width_mm = sheet.width_mm ?? 297;
  const height_mm = sheet.height_mm ?? 210;

  const elements: string[] = [];

  for (const p of sheet.primitives) {
    if (p.type === "line") {
      const stroke = p.strokeColor ?? "#000000";
      const sw = p.strokeWidth ?? 0.35;
      const dash = dashAttr(p.dashPattern ?? p.dash);
      elements.push(
        `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${stroke}" stroke-width="${sw}" ${dash} stroke-linecap="round" />`,
      );
    } else if (p.type === "rect") {
      const sw = p.strokeWidth ?? 0.35;
      const stroke = sw === 0 ? "none" : (p.strokeColor ?? "#000000");
      const fill = p.fillColor ?? "none";
      const dash = dashAttr(p.dashPattern);
      const rx = p.rx != null ? `rx="${p.rx}"` : "";
      elements.push(
        `<rect x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" stroke="${stroke}" stroke-width="${sw}" fill="${fill}" ${rx} ${dash} />`,
      );
    } else if (p.type === "circle") {
      const stroke = p.strokeColor ?? "#000000";
      const sw = p.strokeWidth ?? 0.35;
      const fill = p.fillColor ?? "none";
      elements.push(
        `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" stroke="${stroke}" stroke-width="${sw}" fill="${fill}" />`,
      );
    } else if (p.type === "text") {
      const color = p.color ?? "#000000";
      const anchor = p.align === "center" ? "middle" : p.align === "right" ? "end" : "start";
      // Linha de base explícita (a mesma do PDF); dominant-baseline varia entre navegadores.
      const baselineY = p.y + TEXT_METRICS.baselineOffset(p.baseline) * p.fontSize;
      const weight = p.bold ? 'font-weight="bold"' : "";
      const escaped = p.text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

      const fontSize_mm = p.fontSize.toFixed(3);
      elements.push(
        `<text x="${p.x}" y="${baselineY.toFixed(3)}" font-family="Helvetica, Arial, sans-serif" font-size="${fontSize_mm}" fill="${color}" text-anchor="${anchor}" ${weight}>${escaped}</text>`,
      );
    } else if (p.type === "image") {
      elements.push(
        `<image href="${p.dataUri}" x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" preserveAspectRatio="xMidYMid meet" />`,
      );
    }
  }

  // width/height em mm preservam a escala real ao imprimir o arquivo avulso;
  // max-width evita que a prancha estoure (e seja cortada) no preview da UI.
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width_mm} ${height_mm}" width="${width_mm}mm" height="${height_mm}mm" preserveAspectRatio="xMidYMid meet" style="background-color: #ffffff; max-width: 100%; height: auto;">
  ${elements.join("\n  ")}
</svg>`;
}
