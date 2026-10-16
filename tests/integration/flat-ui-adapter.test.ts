import { describe, expect, it } from "vitest";
import { calculate } from "@engine/index";
import {
  flatStoreToGeotechnicalInput,
  validateFlatPileInput,
} from "@domain/adapters/from-flat-ui";
import { refExpected, refInput } from "../fixtures/reference";

describe("flatStoreToGeotechnicalInput + validate", () => {
  it("exemplo de referência via UI plana reproduz o oráculo", () => {
    const input = flatStoreToGeotechnicalInput(
      {
        pileTypeId: refInput.pileTypeId,
        diameterCm: refInput.diameterCm,
        tipDepth_m: refInput.tipDepth_m,
        waterLevel_m: null,
        layers: refInput.layers,
        designLoad_kN: null,
      },
      {
        mode: "engineering",
        governingRule: "minimum",
        aoki: { fs: 2, pctTip: 100, pctShaft: 100 },
        decourt: {},
        teixeira: { fs: 2, pctTip: 100, pctShaft: 100 },
      },
    );
    const result = calculate(input);
    expect(result.atTip.averagePadm_kN).toBeCloseTo(refExpected.averagePadm_kN, 6);
  });

  it("engineering exige camada exatamente na cota SPT da ponta", () => {
    expect(() =>
      validateFlatPileInput(
        {
          pileTypeId: 6,
          diameterCm: 30,
          tipDepth_m: 4,
          pileTopDepth_m: 0.9,
          waterLevel_m: null,
          layers: [
            { depth_m: 1, nspt: 10, soilTypeId: 12 },
            { depth_m: 4, nspt: 10, soilTypeId: 12 },
          ],
          designLoad_kN: null,
        },
        "engineering",
      ),
    ).toThrow(/cota de apoio/i);
  });
});
