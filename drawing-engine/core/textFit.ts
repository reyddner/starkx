/**
 * Ajuste de texto para caber em caixas da prancha (evita estouro visual).
 *
 * Larguras pelas métricas AFM da Helvetica (a fonte do PDF exportado), em
 * milésimos de em. Na dúvida mede como negrito, que é mais largo.
 */

/** Altura mínima de letra na prancha (mm de corpo ≈ 2,5 mm de maiúscula, NBR 8402). */
export const MIN_FONT_MM = 3.5;

/** Métricas verticais da Helvetica (fração do corpo), usadas no PDF e no SVG. */
export const TEXT_METRICS = {
  capHeight: 0.718,
  descender: 0.207,
  /** Deslocamento da linha de base a partir do `y` da primitiva, em corpos. */
  baselineOffset(baseline?: "top" | "middle" | "bottom"): number {
    if (baseline === "middle") return TEXT_METRICS.capHeight / 2;
    if (baseline === "bottom") return -TEXT_METRICS.descender;
    return 0.8;
  },
};

// ASCII 32..126
const REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778,
  722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
  278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778,
  722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333,
  278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];
/** Caracteres que o PDF troca por sequências (ver sanitizeText do pdfExport). */
const SUBSTITUTE: Record<string, string> = {
  "…": "...",
  "—": " - ",
  "–": "-",
  "•": "*",
  "·": ".",
  "φ": "fi",
  "ϕ": "fi",
  "Ø": "D",
  "⌀": "D",
  "³": "3",
  "²": "2",
};

function charWidth(ch: string, bold: boolean): number {
  const table = bold ? BOLD : REGULAR;
  const code = ch.charCodeAt(0);
  if (code >= 32 && code <= 126) return table[code - 32]!;
  const base = ch.normalize("NFD").charAt(0);
  const baseCode = base.charCodeAt(0);
  if (baseCode >= 32 && baseCode <= 126) return table[baseCode - 32]!;
  return 600;
}

/** Largura em mm do texto impresso em Helvetica no corpo `fontSizeMm`. */
export function estimateTextWidthMm(text: string, fontSizeMm: number, bold = true): number {
  let units = 0;
  for (const ch of text) {
    const sub = SUBSTITUTE[ch];
    if (sub != null) {
      for (const c of sub) units += charWidth(c, bold);
    } else {
      units += charWidth(ch, bold);
    }
  }
  return (units / 1000) * fontSizeMm;
}

/** Trunca com reticências para caber em maxWidthMm. */
export function fitTextToWidth(
  text: string,
  fontSizeMm: number,
  maxWidthMm: number,
  bold = true,
): string {
  const raw = text.trim();
  if (!raw) return "";
  if (estimateTextWidthMm(raw, fontSizeMm, bold) <= maxWidthMm) return raw;
  if (maxWidthMm < fontSizeMm * 2) return "…";
  let lo = 0;
  let hi = raw.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = `${raw.slice(0, mid).trimEnd()}…`;
    if (estimateTextWidthMm(candidate, fontSizeMm, bold) <= maxWidthMm) lo = mid;
    else hi = mid - 1;
  }
  return lo <= 0 ? "…" : `${raw.slice(0, lo).trimEnd()}…`;
}

/** Reduz fontSize até o texto caber (mínimo minFont). */
export function fitFontSize(
  text: string,
  preferredFontMm: number,
  maxWidthMm: number,
  minFontMm = MIN_FONT_MM,
  bold = true,
): number {
  const min = Math.max(MIN_FONT_MM, minFontMm);
  let fs = preferredFontMm;
  while (fs > min && estimateTextWidthMm(text, fs, bold) > maxWidthMm) {
    fs -= 0.1;
  }
  return Math.max(min, Number(fs.toFixed(1)));
}

/**
 * Quebra em até maxLines linhas (por espaços). A última linha trunca com ….
 */
export function wrapTextToLines(
  text: string,
  fontSizeMm: number,
  maxWidthMm: number,
  maxLines: number,
  bold = true,
): string[] {
  const raw = text.trim().replace(/\s+/g, " ");
  if (!raw || maxLines < 1) return [];
  const fits = (s: string) => estimateTextWidthMm(s, fontSizeMm, bold) <= maxWidthMm;
  if (fits(raw)) return [raw];

  const words = raw.split(" ");
  const lines: string[] = [];
  let current = "";

  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    const candidate = current ? `${current} ${word}` : word;
    if (fits(candidate)) {
      current = candidate;
      continue;
    }
    if (lines.length === maxLines - 1) {
      // Última linha: junta o resto e trunca.
      const rest = [current, ...words.slice(i)].filter(Boolean).join(" ");
      lines.push(fitTextToWidth(rest, fontSizeMm, maxWidthMm, bold));
      return lines;
    }
    if (current) {
      lines.push(current);
      current = fits(word) ? word : fitTextToWidth(word, fontSizeMm, maxWidthMm, bold);
    } else {
      lines.push(fitTextToWidth(word, fontSizeMm, maxWidthMm, bold));
      current = "";
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

/**
 * Quebra com o menor corpo que caiba em maxLines (de preferred até MIN_FONT_MM);
 * se nem no mínimo couber, trunca a última linha.
 */
export function fitWrappedText(
  text: string,
  preferredFontMm: number,
  maxWidthMm: number,
  maxLines: number,
  bold = true,
): { lines: string[]; fontSize: number } {
  for (let fs = preferredFontMm; fs >= MIN_FONT_MM - 1e-9; fs -= 0.1) {
    const size = Number(fs.toFixed(1));
    const lines = wrapTextToLines(text, size, maxWidthMm, maxLines, bold);
    if (!lines.some((l) => l.endsWith("…"))) return { lines, fontSize: size };
  }
  return {
    lines: wrapTextToLines(text, MIN_FONT_MM, maxWidthMm, maxLines, bold),
    fontSize: MIN_FONT_MM,
  };
}
