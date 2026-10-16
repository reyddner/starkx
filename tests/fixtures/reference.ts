import reference from "./reference-cases.json";

/** Caso de referência do exemplo do app: estaca escavada Ø30 cm × 8 m. */
export const refExample = reference.cases.find((c) => c.id === "ref-escavada-30")!;
export const refInput = refExample.input as {
  pileTypeId: number;
  diameterCm: number;
  tipDepth_m: number;
  layers: Array<{ depth_m: number; nspt: number; soilTypeId: number }>;
};
export const refExpected = refExample.expected;
