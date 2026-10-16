/**
 * Referencial de cotas estaca/bloco (DEC-57).
 * Cota 0 = topo do bloco (pile_cap) ou superfície de referência.
 * tipDepth_m no store = comprimento L a partir do topo da estaca.
 */

export type PileDatumFoundationKind = "pile" | "pile_cap" | string;

export interface PileDatumInput {
  foundationKind: PileDatumFoundationKind;
  /** Comprimento da estaca a partir do topo (m). */
  tipDepth_m: number;
  blockThickness_m: number;
  blockEmbedment_m: number;
  /** Cota do topo da estaca isolada (relativa à cota 0). Default 0. */
  pileTopElevation_m?: number | null;
}

export interface PileDatum {
  /** Coordenada Z do topo da estaca (≤ 0 tipicamente). */
  pileTop_z: number;
  /** Profundidade do topo da estaca abaixo da cota 0 (≥ 0). */
  pileTopDepth_m: number;
  /** Comprimento L (= tipDepth_m). */
  pileLength_m: number;
  /** Z da ponta. */
  pileTip_z: number;
  /** Profundidade da ponta no perfil SPT (a partir da cota 0). */
  sptTipDepth_m: number;
  /** Espessura efetiva do bloco usada no datum (só pile_cap). */
  blockThickness_m: number;
  /** Embutimento efetivo (clampado). */
  embedment_m: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Resolve topo/ponta da estaca e a cota de apoio no SPT.
 */
export function resolvePileDatum(input: PileDatumInput): PileDatum {
  const L = Number.isFinite(input.tipDepth_m) ? input.tipDepth_m : 0;
  const isCap = input.foundationKind === "pile_cap";

  let pileTop_z: number;
  let blockThickness_m = 0;
  let embedment_m = 0;

  if (isCap) {
    blockThickness_m = Math.max(0.05, input.blockThickness_m || 0.5);
    embedment_m = clamp(
      input.blockEmbedment_m ?? 0.1,
      0,
      blockThickness_m,
    );
    // Topo do bloco = 0; topo da estaca = -(t − e)
    pileTop_z = -(blockThickness_m - embedment_m);
  } else {
    const z = input.pileTopElevation_m;
    pileTop_z = z != null && Number.isFinite(z) ? z : 0;
  }

  const pileTopDepth_m = Math.max(0, -pileTop_z);
  const pileTip_z = pileTop_z - L;
  const sptTipDepth_m = pileTopDepth_m + L;

  return {
    pileTop_z,
    pileTopDepth_m,
    pileLength_m: L,
    pileTip_z,
    sptTipDepth_m,
    blockThickness_m,
    embedment_m,
  };
}

/** Comparação de profundidades fracionárias. */
export function depthsEqual(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps;
}

/**
 * Há camada SPT na cota de ponta do perfil (sptTipDepth)?
 */
export function hasSptAtTipDepth(
  layers: Array<{ depth_m: number }>,
  sptTipDepth_m: number,
  eps = 1e-6,
): boolean {
  return layers.some((l) => depthsEqual(l.depth_m, sptTipDepth_m, eps));
}

export interface SuggestPileLengthInput extends PileDatumInput {
  layers: Array<{ depth_m: number }>;
}

export interface SuggestPileLengthResult {
  tipDepth_m: number;
  sptTipDepth_m: number;
  /** true se L foi alterado para alinhar a uma camada SPT. */
  snapped: boolean;
}

function roundDepth(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Se a ponta SPT (pileTopDepth + L) não cair numa camada, sugere L
 * alinhado à camada mais próxima com L ≥ 1 m (prefere cota ≥ desejada).
 */
export function suggestPileLengthForSpt(
  input: SuggestPileLengthInput,
): SuggestPileLengthResult {
  const datum = resolvePileDatum(input);
  const L = datum.pileLength_m;
  const top = datum.pileTopDepth_m;
  const desired = datum.sptTipDepth_m;

  if (hasSptAtTipDepth(input.layers, desired)) {
    return { tipDepth_m: L, sptTipDepth_m: desired, snapped: false };
  }

  const candidates = input.layers
    .map((l) => l.depth_m)
    .filter((d) => Number.isFinite(d) && d - top >= 1 - 1e-9)
    .sort((a, b) => a - b);

  if (candidates.length === 0) {
    return { tipDepth_m: L, sptTipDepth_m: desired, snapped: false };
  }

  // Preferência: menor |d − desired|; empate → cota ≥ desired (mais profunda).
  let best = candidates[0]!;
  let bestDist = Math.abs(best - desired);
  for (const d of candidates) {
    const dist = Math.abs(d - desired);
    if (dist + 1e-9 < bestDist) {
      best = d;
      bestDist = dist;
    } else if (Math.abs(dist - bestDist) <= 1e-9 && d >= desired && best < desired) {
      best = d;
    }
  }

  const newL = roundDepth(best - top);
  return {
    tipDepth_m: newL,
    sptTipDepth_m: best,
    snapped: !depthsEqual(newL, L),
  };
}
