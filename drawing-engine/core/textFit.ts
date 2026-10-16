/**
 * Ajuste de texto para caber em caixas da prancha (evita estouro visual).
 *
 * Fator 0,62: Helvetica Bold costuma ser mais largo que a estimativa 0,55;
 * preferimos truncar cedo a vazar da caixa no PDF.
 */

const CHAR_WIDTH_FACTOR = 0.62;

/** Estimativa: CHAR_WIDTH_FACTOR × fontSize por caractere em mm. */
export function estimateTextWidthMm(text: string, fontSizeMm: number): number {
  return Math.max(0, text.length) * fontSizeMm * CHAR_WIDTH_FACTOR;
}

/** Trunca com reticências para caber em maxWidthMm. */
export function fitTextToWidth(
  text: string,
  fontSizeMm: number,
  maxWidthMm: number,
): string {
  const raw = text.trim();
  if (!raw) return "";
  if (estimateTextWidthMm(raw, fontSizeMm) <= maxWidthMm) return raw;
  if (maxWidthMm < fontSizeMm * 2) return "…";
  let lo = 0;
  let hi = raw.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = `${raw.slice(0, mid)}…`;
    if (estimateTextWidthMm(candidate, fontSizeMm) <= maxWidthMm) lo = mid;
    else hi = mid - 1;
  }
  return lo <= 0 ? "…" : `${raw.slice(0, lo)}…`;
}

/** Reduz fontSize até o texto caber (mínimo minFont). */
export function fitFontSize(
  text: string,
  preferredFontMm: number,
  maxWidthMm: number,
  minFontMm = 3.2,
): number {
  let fs = preferredFontMm;
  while (fs > minFontMm && estimateTextWidthMm(text, fs) > maxWidthMm) {
    fs -= 0.3;
  }
  return Math.max(minFontMm, Number(fs.toFixed(1)));
}

/**
 * Quebra em até maxLines linhas (por espaços). A última linha trunca com ….
 */
export function wrapTextToLines(
  text: string,
  fontSizeMm: number,
  maxWidthMm: number,
  maxLines: number,
): string[] {
  const raw = text.trim().replace(/\s+/g, " ");
  if (!raw || maxLines < 1) return [];
  if (estimateTextWidthMm(raw, fontSizeMm) <= maxWidthMm) return [raw];

  const words = raw.split(" ");
  const lines: string[] = [];
  let current = "";

  const pushLine = (line: string, isLastSlot: boolean) => {
    lines.push(
      isLastSlot ? fitTextToWidth(line, fontSizeMm, maxWidthMm) : line,
    );
  };

  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    const candidate = current ? `${current} ${word}` : word;
    const remainingSlots = maxLines - lines.length;

    if (remainingSlots <= 1) {
      const rest = [candidate, ...words.slice(i + 1)].join(" ");
      pushLine(rest, true);
      return lines;
    }

    if (estimateTextWidthMm(candidate, fontSizeMm) <= maxWidthMm) {
      current = candidate;
      continue;
    }

    if (current) {
      pushLine(current, false);
      current = word;
    } else {
      pushLine(fitTextToWidth(word, fontSizeMm, maxWidthMm), false);
      current = "";
    }
  }

  if (current) {
    pushLine(current, lines.length + 1 >= maxLines);
  }

  return lines.slice(0, maxLines);
}
