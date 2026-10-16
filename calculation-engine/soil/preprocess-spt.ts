import type { SoilLayerInput } from "../types";

/**
 * Linha do perfil SPT já preparada para os três métodos.
 * Cada linha pode ser a cota de ponta de uma estaca (varredura de comprimento),
 * por isso Q/R/T/U são calculados tomando a própria linha como ponta.
 */
export interface SptRow {
  depth_m: number;
  /** Espessura da fatia (m): distância até o SPT anterior (ou até a superfície). */
  thickness_m: number;
  /** Espessura da fatia que fica no fuste (abaixo do topo da estaca). */
  shaftThickness_m: number;
  nspt: number;
  soilTypeId: number;
  /** Décourt-Quaresma: N limitado a 3 ≤ N ≤ 15 (Décourt & Quaresma, 1978). */
  P: number;
  /** Décourt-Quaresma: Np = média do N na ponta, 1 m acima e 1 m abaixo. */
  Q: number;
  /** Décourt-Quaresma: N̄L do fuste (sem os SPT usados em Np), com esta linha como ponta. */
  R: number;
  /** Teixeira: N limitado a 4 ≤ N ≤ 40 (Teixeira, 1996). */
  S: number;
  /** Teixeira: Np = média do N entre 4D acima e 1D abaixo da ponta. */
  T: number;
  /** Teixeira: N̄L do fuste, com esta linha como ponta. */
  U: number;
  /** Rl desta fatia = 0 (camada marcada para exclusão de atrito, DEC-47). */
  excludeFromShaftFriction: boolean;
}

const EPS = 1e-9;

export function clampDecourtN(n: number): number {
  return Math.min(15, Math.max(3, n));
}

export function clampTeixeiraN(n: number): number {
  return Math.min(40, Math.max(4, n));
}

function mean(values: number[]): number {
  if (values.length === 0) throw new Error("Média sem valores");
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Média ponderada pela espessura; null quando não há peso. */
function weightedMean(items: Array<{ v: number; w: number }>): number | null {
  const W = items.reduce((a, it) => a + it.w, 0);
  if (W <= EPS) return null;
  return items.reduce((a, it) => a + it.v * it.w, 0) / W;
}

/**
 * Fatias do fuste com a ponta na linha `tipIndex`: as de espessura > 0 abaixo do topo
 * da estaca e não excluídas do atrito.
 */
export function shaftSlices(rows: SptRow[], tipIndex: number): SptRow[] {
  return rows
    .slice(0, tipIndex + 1)
    .filter((r) => r.shaftThickness_m > EPS && !r.excludeFromShaftFriction);
}

/**
 * Fatias cujo SPT entra em Np do Décourt-Quaresma (ponta e até 1 m acima).
 * Pela definição do método, esses valores não entram em N̄L.
 */
export function isInDecourtTipWindow(row: SptRow, tip: SptRow): boolean {
  return row.depth_m > tip.depth_m - 1 - 1e-6;
}

/** N̄L do Décourt-Quaresma (ponderado pela espessura) para a ponta em `tipIndex`. */
export function decourtShaftMeanN(rows: SptRow[], tipIndex: number): number {
  const tip = rows[tipIndex]!;
  const slices = shaftSlices(rows, tipIndex);
  const outside = slices.filter((r) => !isInDecourtTipWindow(r, tip));
  const pick = outside.length > 0 ? outside : slices;
  return weightedMean(pick.map((r) => ({ v: r.P, w: r.shaftThickness_m }))) ?? tip.P;
}

/** N̄L do Teixeira (ponderado pela espessura) para a ponta em `tipIndex`. */
export function teixeiraShaftMeanN(rows: SptRow[], tipIndex: number): number {
  const slices = shaftSlices(rows, tipIndex);
  return weightedMean(slices.map((r) => ({ v: r.S, w: r.shaftThickness_m }))) ?? rows[tipIndex]!.S;
}

/**
 * Np do Teixeira: média dos N (limitados) dos SPT entre 4D acima e 1D abaixo da ponta.
 * Usa também os SPT abaixo da cota de apoio, quando informados.
 */
export function teixeiraTipN(
  layers: Array<{ depth_m: number; nspt: number }>,
  tipDepth_m: number,
  diameterCm: number,
): number {
  const D = diameterCm / 100;
  const lo = tipDepth_m - 4 * D - 1e-6;
  const hi = tipDepth_m + D + 1e-6;
  const inWindow = layers.filter((l) => l.depth_m >= lo && l.depth_m <= hi);
  const tipLayer = layers.find((l) => Math.abs(l.depth_m - tipDepth_m) <= 1e-6);
  const values = (inWindow.length > 0 ? inWindow : tipLayer ? [tipLayer] : []).map((l) =>
    clampTeixeiraN(l.nspt),
  );
  return mean(values);
}

export interface PreprocessSptOptions {
  /** Profundidade do topo da estaca abaixo da cota 0 (m). Default 0. */
  pileTopDepth_m?: number;
}

/**
 * Prepara o perfil SPT até a cota de ponta (sptTipDepth_m).
 * Camadas abaixo da ponta só entram nas médias de ponta (Np).
 */
export function preprocessSpt(
  layers: SoilLayerInput[],
  sptTipDepth_m: number,
  diameterCm: number,
  opts: PreprocessSptOptions = {},
): SptRow[] {
  const pileTopDepth_m = Math.max(0, opts.pileTopDepth_m ?? 0);
  const sorted = [...layers].sort((a, b) => a.depth_m - b.depth_m);
  if (sorted.length === 0) {
    throw new Error("Informe ao menos uma camada SPT.");
  }
  if (!sorted.some((l) => Math.abs(l.depth_m - sptTipDepth_m) <= 1e-6)) {
    throw new Error(
      `NSPT ausente na cota de apoio ${sptTipDepth_m} m (obrigatório camada exatamente na ponta).`,
    );
  }

  const uptoTip = sorted.filter((l) => l.depth_m <= sptTipDepth_m + 1e-6);

  const rows: SptRow[] = uptoTip.map((layer, i) => {
    const prevDepth = i === 0 ? 0 : uptoTip[i - 1]!.depth_m;
    const thickness_m = Math.max(EPS, layer.depth_m - prevDepth);
    const shaftTop = Math.max(prevDepth, pileTopDepth_m);
    return {
      depth_m: layer.depth_m,
      thickness_m,
      shaftThickness_m: Math.max(0, layer.depth_m - shaftTop),
      nspt: layer.nspt,
      soilTypeId: layer.soilTypeId,
      P: clampDecourtN(layer.nspt),
      Q: 0,
      R: 0,
      S: clampTeixeiraN(layer.nspt),
      T: 0,
      U: 0,
      excludeFromShaftFriction: layer.excludeFromShaftFriction === true,
    };
  });

  rows.forEach((row, i) => {
    // Np Décourt: SPT na ponta, imediatamente acima e imediatamente abaixo (N sem limite).
    const k = sorted.findIndex((l) => Math.abs(l.depth_m - row.depth_m) <= 1e-6);
    const around = [sorted[k - 1], sorted[k], sorted[k + 1]].filter(
      (l): l is SoilLayerInput => l != null,
    );
    row.Q = mean(around.map((l) => l.nspt));
    row.R = decourtShaftMeanN(rows, i);
    row.T = teixeiraTipN(sorted, row.depth_m, diameterCm);
    row.U = teixeiraShaftMeanN(rows, i);
  });

  return rows;
}
