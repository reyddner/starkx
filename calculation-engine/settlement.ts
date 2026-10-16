/**
 * Scaffold de recalque (DEC-37 W7).
 * Não inventa critérios: retorna status explícito até haver modelo referenciado.
 */

export type SettlementStatus = "not_implemented" | "insufficient_data";

export interface SettlementAssessment {
  status: SettlementStatus;
  message: string;
  settlement_mm: null;
  reference: string;
}

export function assessPileSettlement(_input: {
  tipDepth_m: number;
  diameter_m: number;
  load_kN: number;
}): SettlementAssessment {
  return {
    status: "not_implemented",
    message:
      "Recalque da estaca/grupo: módulo ainda não implementado. Não há valor estimado apresentado como resultado de projeto.",
    settlement_mm: null,
    reference: "DEC-37 / DEC-08 — futuro",
  };
}
