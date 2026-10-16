import { describe, expect, it } from "vitest";
import { analyzeAssist } from "../../assist-engine/index";

describe("assist-engine", () => {
  it("nunca inventa Padm — só findings (DEC-27)", () => {
    const findings = analyzeAssist({
      foundationKind: "pile",
      pile: {
        tipDepth_m: 4,
        diameterCm: 30,
        designLoad_kN: 500,
        mode: "engineering",
        governingPadm_kN: 200,
        averagePadm_kN: 220,
        minimumPadm_kN: 200,
        verdict: "not_ok",
        governingMethodId: "minimum",
        layerCount: 4,
        maxLayerDepth_m: 4,
        warnings: [],
      },
    });
    expect(findings.some((f) => f.id === "scope.ai")).toBe(true);
    const fail = findings.find((f) => f.id === "pile.capacity.fail");
    expect(fail).toBeDefined();
    expect(fail!.message).toMatch(/O quê:.*Por quê:.*Como corrigir:/s);
    expect(fail!.actions?.length).toBeGreaterThan(0);
    expect(fail!.actions![0]!.patch.tipDepth_m).toBe(5);
  });

  it("alerta η indicativa no bloco", () => {
    const findings = analyzeAssist({
      foundationKind: "pile_cap",
      pile: {
        tipDepth_m: 8,
        diameterCm: 40,
        designLoad_kN: 800,
        mode: "engineering",
        governingPadm_kN: 900,
        averagePadm_kN: 950,
        minimumPadm_kN: 900,
        verdict: "approved",
        governingMethodId: "aoki_velloso",
        layerCount: 8,
        maxLayerDepth_m: 10,
        warnings: [],
      },
      block: {
        efficiencyUserProvided: false,
        groupCapacityIndicative: true,
        capacityOk: null,
        punchingOk: true,
        strutOk: true,
      },
    });
    expect(findings.some((f) => f.id === "block.eta")).toBe(true);
  });

  it("interpreta sapata sem inventar B/L", () => {
    const findings = analyzeAssist({
      foundationKind: "footing",
      shallow: {
        kind: "footing",
        Nd_kN: 1000,
        qadm_kPa: 200,
        sigmaMax_kPa: 250,
        hasErrors: false,
        hasWarnings: true,
        rebarMessage: "As,mín teste",
      },
    });
    expect(findings.some((f) => f.id === "shallow.pressure")).toBe(true);
    expect(findings.some((f) => f.id === "shallow.rebar")).toBe(true);
    expect(findings.every((f) => !f.actions?.some((a) => "B_m" in a.patch))).toBe(
      true,
    );
  });
});
