import { designFooting } from "../footing-engine/design";
import type { FootingDesignInput, FootingDesignResult } from "../footing-engine/types";

export type RaftDesignInput = Omit<FootingDesignInput, "shape" | "elementKind"> & {
  /** L/B ≥ 1; default 1 (quadrado) */
  aspectRatio?: number;
};

export type RaftDesignResult = FootingDesignResult & {
  kind: "raft";
};

/**
 * Radier retangular — dimensionamento geotécnico (área e tensões em serviço).
 * Espessura sugerida max(0,40 m; B/10). Esforços na placa ficam fora do escopo.
 */
export function designRaft(input: RaftDesignInput): RaftDesignResult {
  const aspect = Math.max(1, input.aspectRatio ?? 1);
  const footing = designFooting({
    ...input,
    shape: aspect <= 1.001 ? "square" : "rectangular",
    aspectRatio: aspect,
    elementKind: "raft",
  });
  return {
    ...footing,
    kind: "raft",
    traces: [
      ...footing.traces,
      {
        stepId: "raft.thickness",
        title: "Espessura sugerida (radier)",
        formula: "t_sug = max(0,40; B/10)",
        substitutions: { B_m: footing.B_m, t_sug_m: footing.thicknessSuggested_m },
        result: footing.thicknessSuggested_m,
        unit: "m",
        reference: "Pré-dimensionamento",
      },
    ],
  };
}
