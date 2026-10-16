import { describe, expect, it } from "vitest";
import { calculate } from "@engine/index";
import { toGeotechnicalInput } from "@domain/adapters/to-geotechnical-input";
import type { Borehole, PileFoundation } from "@domain/types";
import { refInput, refExpected } from "../fixtures/reference";

describe("domain adapter → motor (exemplo)", () => {
  it("reproduz o oráculo via domínio paramétrico", () => {
    const borehole: Borehole = {
      id: "bh-1",
      label: "SP-01",
      waterLevel_m: null,
      source: "manual",
      layers: refInput.layers.map((l) => ({
        topDepth_m: l.depth_m - 1,
        bottomDepth_m: l.depth_m,
        nspt: l.nspt,
        soilTypeId: l.soilTypeId,
      })),
    };

    const pile: PileFoundation = {
      id: "pile-1",
      kind: "pile",
      label: "E1",
      boreholeId: "bh-1",
      pileTypeId: 6,
      diameter_m: 0.3,
      length_m: 8,
      tipDepth_m: 8,
      position: { x_m: 0, y_m: 0 },
    };

    const input = toGeotechnicalInput(pile, borehole, {
      mode: "engineering",
      governingRule: "average",
      aoki: { fs: 2, pctTip: 100, pctShaft: 100 },
      decourt: {},
      teixeira: { fs: 2, pctTip: 100, pctShaft: 100 },
    });

    const result = calculate(input);
    expect(result.atTip.averagePadm_kN).toBeCloseTo(refExpected.averagePadm_kN, 6);
    expect(result.steps.every((s) => s.status === "done")).toBe(true);
    expect(result.steps).toHaveLength(6);
  });
});
