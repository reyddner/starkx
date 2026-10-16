import { describe, expect, it } from "vitest";
import {
  designPileGroup,
  suggestMinPileCount,
  suggestPileGroupLayout,
  suggestRectLayout,
} from "@group/index";
import {
  assessNegativeSkinFriction,
  assessPileSettlement,
  categoryOfPileType,
  pileTypesInCategory,
} from "@engine/index";

describe("pile-group-engine", () => {
  it("1 estaca: Nmáx = N", () => {
    const r = designPileGroup({
      rows: 1,
      cols: 1,
      spacing_m: 1,
      diameter_m: 0.3,
      N_kN: 200,
      Mx_kNm: 0,
      My_kNm: 0,
      singlePadm_kN: 250,
      efficiency: 1,
    });
    expect(r.maxPileLoad_kN).toBeCloseTo(200, 6);
    expect(r.ok).toBe(true);
  });

  it("momento gera variação de carga", () => {
    const r = designPileGroup({
      rows: 1,
      cols: 2,
      spacing_m: 1,
      diameter_m: 0.3,
      N_kN: 100,
      Mx_kNm: 0,
      My_kNm: 200,
      singlePadm_kN: 300,
      efficiency: 1,
    });
    expect(r.maxPileLoad_kN).toBeGreaterThan(r.minPileLoad_kN);
  });

  it("suggestMinPileCount", () => {
    expect(suggestMinPileCount(500, 200)).toBe(3);
    expect(suggestRectLayout(4)).toEqual({ rows: 2, cols: 2 });
  });

  it("suggestPileGroupLayout considera momentos", () => {
    const onlyN = suggestPileGroupLayout({
      N_kN: 400,
      singlePadm_kN: 250,
      diameter_m: 0.3,
      efficiency: 1,
    });
    expect(onlyN.nPiles).toBe(2);

    const withM = suggestPileGroupLayout({
      N_kN: 400,
      Mx_kNm: 0,
      My_kNm: 800,
      singlePadm_kN: 250,
      diameter_m: 0.3,
      efficiency: 1,
    });
    // Com My alto, 1×2 estoura Nmáx — exige grade maior que só N/Padm.
    expect(withM.nPiles).toBeGreaterThan(onlyN.nPiles);
    expect(withM.trial.maxPileLoad_kN).toBeLessThanOrEqual(250 + 1e-6);
  });
});

describe("pile catalog + scaffolds W7", () => {
  it("categoria moldada contém Escavada", () => {
    expect(categoryOfPileType(6)).toBe("moldada_in_loco");
    expect(pileTypesInCategory("moldada_in_loco").some((p) => p.id === 6)).toBe(true);
  });

  it("recalque e atrito negativo não inventam números", () => {
    const s = assessPileSettlement({ tipDepth_m: 10, diameter_m: 0.4, load_kN: 500 });
    expect(s.settlement_mm).toBeNull();
    expect(s.status).toBe("not_implemented");
    const n = assessNegativeSkinFriction({ layers: [] });
    expect(n.force_kN).toBeNull();
  });
});
