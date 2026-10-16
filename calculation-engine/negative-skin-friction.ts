/**
 * Atrito negativo (força) vs exclusão de fuste (DEC-47).
 * Exclusão de Rl por camada é aplicada nos métodos; força de atrito negativo
 * permanece não implementada (sem hipóteses silenciosas).
 */

export type NegativeSkinStatus =
  | "not_applicable"
  | "insufficient_data"
  | "shaft_excluded"
  | "flagged_layers";

export interface NegativeSkinAssessment {
  status: NegativeSkinStatus;
  message: string;
  force_kN: null;
  layersFlagged: number;
}

export function assessNegativeSkinFriction(input: {
  layers: { excludeFromShaftFriction?: boolean; excludeReason?: string }[];
}): NegativeSkinAssessment {
  const flagged = input.layers.filter((l) => l.excludeFromShaftFriction);
  if (flagged.length === 0) {
    return {
      status: "not_applicable",
      message:
        "Nenhuma camada marcada para exclusão de atrito / atrito negativo. Cadastre justificativa na sondagem se aplicável.",
      force_kN: null,
      layersFlagged: 0,
    };
  }
  const missingReason = flagged.some((l) => !l.excludeReason?.trim());
  if (missingReason) {
    return {
      status: "insufficient_data",
      message:
        "Há camadas excluídas do atrito sem justificativa. Informe a razão técnica (recomendado). A exclusão de Rl no motor já se aplica se o flag estiver marcado.",
      force_kN: null,
      layersFlagged: flagged.length,
    };
  }
  return {
    status: "shaft_excluded",
    message: `${flagged.length} camada(s) com exclusão de atrito lateral (Rl=0 nesse metro). Força de atrito negativo (down-drag) ainda não é calculada.`,
    force_kN: null,
    layersFlagged: flagged.length,
  };
}
