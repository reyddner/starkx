/**
 * Score de candidatos Ø × L × n (DEC-58).
 *
 * Critérios, em ordem de peso: segurança (gate) → apoio em camada resistente e
 * esbeltez → utilização → economia (custo de execução) → execução (n, L, Ø).
 *
 * A dimensão "bearing" existe porque volume de concreto sozinho premiava estaca
 * fina e muito longa flutuando em solo mole; na prática, para carga pequena,
 * compensa engrossar um pouco e apoiar a ponta na primeira camada competente.
 */

import type { PileSolutionCandidate } from "../types";

/** Campos do candidato necessários ao score (sem os campos derivados do score). */
export type ScorableCandidate = Omit<
  PileSolutionCandidate,
  "score" | "scoreBreakdown" | "rationale"
>;

export interface ScoreContext {
  /** Cota de início da primeira camada competente (m), quando existe. */
  resistantOnset_m: number | null;
  /** Custo relativo mínimo/máximo do pool, para normalizar economia. */
  costMin: number;
  costMax: number;
  /** Carga do pilar (kN). Cargas pequenas premiam apoio raso em camada resistente. */
  N_kN?: number;
  /** Profundidade máxima da sondagem (m). */
  profileMaxDepth_m?: number;
}

export type ScoreResult = Pick<
  PileSolutionCandidate,
  "score" | "scoreBreakdown" | "rationale"
>;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Proxy de custo de execução, não de volume puro.
 *
 * Perfurar 1 m de Ø30 custa bem menos que 1 m de Ø80, mas a relação não é
 * quadrática como o volume sugere: mobilização, armadura e concretagem diluem a
 * diferença. Usamos expoente 1,4 sobre o diâmetro e somamos uma parcela fixa
 * por estaca (mobilização/locação por elemento).
 */
export function relativePileCost(c: ScorableCandidate): number {
  const d_m = c.diameterCm / 100;
  const perMeter = Math.pow(d_m, 1.4);
  const perPile = 0.35;
  return Number((c.nPiles * (perPile + perMeter * c.tipDepth_m)).toFixed(4));
}

/** Esbeltez aceitável por experiência de execução; acima disso, penaliza. */
const SLENDERNESS_IDEAL_MAX = 40;
const SLENDERNESS_HARD_MAX = 80;

function bearingScore(c: ScorableCandidate, ctx: ScoreContext): number {
  let score = 5;

  if (c.bearsOnResistantLayer) score += 4;
  else if (ctx.resistantOnset_m == null) score += 1; // perfil sem camada clara: neutro

  if (c.tipNspt != null) {
    if (c.tipNspt >= 25) score += 1.5;
    else if (c.tipNspt >= 15) score += 1;
    else if (c.tipNspt < 8) score -= 2.5;
  }

  const sl = c.slenderness;
  if (sl > SLENDERNESS_HARD_MAX) score -= 4;
  else if (sl > SLENDERNESS_IDEAL_MAX) {
    score -= (2 * (sl - SLENDERNESS_IDEAL_MAX)) / (SLENDERNESS_HARD_MAX - SLENDERNESS_IDEAL_MAX);
  }

  // Evita cravar metros a mais depois de já ter sentado na camada competente.
  if (ctx.resistantOnset_m != null && c.bearsOnResistantLayer) {
    const extra_m = c.tipDepth_m - ctx.resistantOnset_m;
    if (extra_m >= 0 && extra_m <= 2) score += 1.2;
    else if (extra_m > 2.5) score -= Math.min(3, (extra_m - 2.5) * 0.5);
  }

  return clamp01(score / 12) * 10;
}

function efficiencyScore(u: number): number {
  if (u >= 0.55 && u <= 0.88) return 10;
  if (u >= 0.4 && u < 0.55) return 7;
  if (u > 0.88 && u <= 0.95) return 6;
  if (u < 0.4) return 4;
  return 2;
}

function executionScore(c: ScorableCandidate, ctx: ScoreContext): number {
  const nPenalty = Math.min(6, Math.max(0, c.nPiles - 1) * 1.2);
  const lengthPenalty = Math.min(3, Math.max(0, (c.tipDepth_m - 8) * 0.15));
  const shortPenalty =
    c.tipDepth_m < 3 - 1e-9 && (ctx.profileMaxDepth_m ?? 0) >= 4 - 1e-9 ? 4 : 0;
  const diaPenalty =
    c.diameterCm > 80 ? Math.min(5, (c.diameterCm - 80) / 20) : c.diameterCm > 60 ? 1 : 0;
  const microPenalty = c.diameterCm < 20 && c.nPiles > 6 ? 2 : 0;
  return clamp01((10 - nPenalty - lengthPenalty - shortPenalty - diaPenalty - microPenalty) / 10) * 10;
}

export function scorePileCandidate(c: ScorableCandidate, ctx: ScoreContext): ScoreResult {
  if (!c.ok || !(c.padmGoverning_kN > 0)) {
    return {
      score: 0,
      scoreBreakdown: { safety: 0, efficiency: 0, economy: 0, execution: 0, bearing: 0 },
      rationale: "Solução inviável (capacidade do grupo insuficiente).",
    };
  }

  const safety = 10;
  const efficiency = efficiencyScore(c.utilization);
  const bearing = bearingScore(c, ctx);

  const costSpan = Math.max(1e-6, ctx.costMax - ctx.costMin);
  const economy = 10 * (1 - clamp01((relativePileCost(c) - ctx.costMin) / costSpan));

  const execution = executionScore(c, ctx);

  const smallLoad = (ctx.N_kN ?? 0) > 0 && (ctx.N_kN ?? 0) <= 500;
  const wBearing = smallLoad ? 0.28 : 0.2;
  const wEconomy = smallLoad ? 0.1 : 0.18;
  const wExec = smallLoad ? 0.12 : 0.12;
  const wEff = smallLoad ? 0.2 : 0.2;
  const wSafety = 0.3;

  const score =
    wSafety * safety + wBearing * bearing + wEff * efficiency + wEconomy * economy + wExec * execution;

  const bearingNote = c.bearsOnResistantLayer
    ? `Ponta apoiada em camada resistente${c.tipNspt != null ? ` (NSPT ${c.tipNspt})` : ""}.`
    : ctx.resistantOnset_m != null
      ? `Ponta acima da camada competente (~${ctx.resistantOnset_m.toFixed(1)} m) — resistência vem mais do fuste.`
      : "Perfil sem camada competente clara no trecho sondado.";

  const rationale = [
    `Padm=${c.padmGoverning_kN.toFixed(0)} kN/estaca · n=${c.nPiles} · utilização ${(c.utilization * 100).toFixed(0)}%.`,
    `L=${c.tipDepth_m.toFixed(1)} m · Ø${c.diameterCm} cm · esbeltez L/D=${c.slenderness.toFixed(0)}.`,
    bearingNote,
    c.nPiles > 1
      ? `η Converse-Labarre=${c.efficiency.toFixed(2)} aplicada automaticamente para verificação de grupo (ajustável pelo RT).`
      : "Estaca isolada (η=1).",
  ].join(" ");

  return {
    score: Number(score.toFixed(2)),
    scoreBreakdown: {
      safety: Number(safety.toFixed(1)),
      efficiency: Number(efficiency.toFixed(1)),
      economy: Number(economy.toFixed(1)),
      execution: Number(execution.toFixed(1)),
      bearing: Number(bearing.toFixed(1)),
    },
    rationale,
  };
}
