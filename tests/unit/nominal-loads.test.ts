import { describe, expect, it } from "vitest";
import { calculate } from "@engine/index";
import {
  assessNominalStructuralCapacity,
  lookupNominalStructuralLoad_kN,
} from "@engine/nominal-loads";
import { analyzeAssist } from "../../assist-engine/index";
import { refInput, refExpected } from "../fixtures/reference";

describe("DEC-09 — carga estrutural usual", () => {
  it("lookup Escavada Ø30 = 300 kN", () => {
    const hit = lookupNominalStructuralLoad_kN(6, 30);
    expect(hit).not.toBeNull();
    expect(hit!.nominal_kN).toBe(300);
  });

  it("metálica e Ø sem linha → null", () => {
    expect(lookupNominalStructuralLoad_kN(4, 30)).toBeNull();
    expect(lookupNominalStructuralLoad_kN(6, 31)).toBeNull();
  });

  it("assess: Padm > nominal → exceeded", () => {
    const a = assessNominalStructuralCapacity({
      pileTypeId: 6,
      diameterCm: 30,
      governingPadm_kN: 400,
    });
    expect(a).not.toBeNull();
    expect(a!.exceeded).toBe(true);
    expect(a!.message).toMatch(/DEC-09/);
  });

  it("exemplo (escavada Ø30): Padm < carga usual de 300 kN → sem alerta", () => {
    const r = calculate(refInput as Parameters<typeof calculate>[0]);
    expect(r.atTip.governingPadm_kN).toBeCloseTo(refExpected.minimumPadm_kN, 6);
    expect(r.nominalStructural).not.toBeNull();
    expect(r.nominalStructural!.nominal_kN).toBe(300);
    expect(r.nominalStructural!.exceeded).toBe(false);
    expect(r.warnings.every((w) => !/DEC-09/.test(w))).toBe(true);
  });

  it("Padm alto dispara warning sem mudar Padm", () => {
    const layers = Array.from({ length: 12 }, (_, i) => ({
      depth_m: i + 1,
      nspt: 40,
      soilTypeId: 12,
    }));
    const r = calculate({
      pileTypeId: 6,
      diameterCm: 30,
      tipDepth_m: 12,
      layers,
      mode: "engineering",
      governingRule: "average",
      aoki: { fs: 2, pctTip: 100, pctShaft: 100 },
      decourt: { alphaPct: 100, betaPct: 100 },
      teixeira: { fs: 2, pctTip: 100, pctShaft: 100 },
    });
    expect(r.atTip.governingPadm_kN).toBeGreaterThan(300);
    expect(r.nominalStructural?.exceeded).toBe(true);
    expect(r.warnings.some((w) => /DEC-09/.test(w))).toBe(true);
    // Padm permanece o valor geotécnico (não clipado ao nominal)
    expect(r.atTip.governingPadm_kN).toBeGreaterThan(
      r.nominalStructural!.nominal_kN,
    );
  });

  it("Assist interpreta nominal exceeded", () => {
    const findings = analyzeAssist({
      foundationKind: "pile",
      pile: {
        tipDepth_m: 12,
        diameterCm: 30,
        designLoad_kN: 200,
        mode: "engineering",
        governingPadm_kN: 450,
        averagePadm_kN: 500,
        minimumPadm_kN: 450,
        verdict: "approved",
        governingMethodId: "minimum",
        layerCount: 12,
        maxLayerDepth_m: 12,
        warnings: ["Padm governante (450.0 kN) > carga estrutural usual (300 kN) — DEC-09."],
        nominal_kN: 300,
        nominalExceeded: true,
      },
    });
    expect(findings.some((f) => f.id === "pile.nominal.exceeded")).toBe(true);
    expect(
      findings.filter((f) => f.id.startsWith("pile.warn.")).length,
    ).toBe(0);
  });
});
