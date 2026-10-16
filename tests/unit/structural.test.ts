import { describe, expect, it } from "vitest";
import { barArea_cm2, designPileReinforcement } from "@structural/index";

describe("structural-engine — estaca escavada Ø30", () => {
  it("As,mín = 0,4% Ac e detalhe ≥ 6φ10", () => {
    const r = designPileReinforcement({
      pileTypeId: 6,
      diameter_m: 0.3,
      tipDepth_m: 4,
      Nk_kN: 100,
      loadIsDesign: false,
    });

    expect(r.Ac_m2).toBeCloseTo(0.07068583470577035, 9);
    expect(r.As_min_cm2).toBeCloseTo(0.004 * r.Ac_m2 * 1e4, 6);
    expect(r.As_min_cm2).toBeCloseTo(2.827433388, 5);
    expect(r.detail).not.toBeNull();
    expect(r.detail!.longitudinal.count).toBeGreaterThanOrEqual(6);
    expect(r.detail!.longitudinal.As_cm2).toBeGreaterThanOrEqual(r.As_nec_cm2 - 1e-9);
    // carga baixa → σ provavelmente ≤ 5 MPa → ligação
    expect(["ok", "ok_min_connection"]).toContain(r.status);
  });

  it("metálica → not_applicable", () => {
    const r = designPileReinforcement({
      pileTypeId: 4,
      diameter_m: 0.3,
      tipDepth_m: 8,
      Nk_kN: 200,
    });
    expect(r.status).toBe("not_applicable");
  });

  it("área de barra φ10", () => {
    expect(barArea_cm2(10)).toBeCloseTo(0.785398163, 6);
  });

  it("carga alta exige As de cálculo e Nrd ≥ Nd", () => {
    const r = designPileReinforcement({
      pileTypeId: 6,
      diameter_m: 0.3,
      tipDepth_m: 4,
      Nk_kN: 800,
      loadIsDesign: true,
    });
    expect(r.Nd_kN).toBe(800);
    expect(r.As_nec_cm2).toBeGreaterThanOrEqual(r.As_min_cm2);
    if (r.status === "ok" || r.status === "ok_min_connection") {
      expect(r.Nrd_kN).toBeGreaterThanOrEqual(r.Nd_kN - 1e-6);
    }
  });

  it("Apiloada usa parâmetros de escavada (DEC-19)", () => {
    const r = designPileReinforcement({
      pileTypeId: 8,
      diameter_m: 0.3,
      tipDepth_m: 4,
      Nk_kN: 100,
      loadIsDesign: false,
    });
    expect(r.params?.source).toMatch(/Apiloada/i);
    expect(r.params?.fck_MPa).toBe(25);
    expect(r.params?.gammaC).toBe(3.1);
    expect(r.As_min_cm2).toBeCloseTo(0.004 * r.Ac_m2 * 1e4, 6);
  });

  it("sem M/V permanece em compressão centrada", () => {
    const r = designPileReinforcement({
      pileTypeId: 6,
      diameter_m: 0.3,
      tipDepth_m: 4,
      Nk_kN: 100,
      loadIsDesign: false,
    });
    expect(r.nm?.mode).toBe("centered");
  });

  it("compressão centrada: Nrd = 0,85·fcd·Ac + As·σs(2‰)", () => {
    const r = designPileReinforcement({ pileTypeId: 6, diameter_m: 0.4, tipDepth_m: 8, Nk_kN: 600 });
    const fcd = 25 / 3.1;
    const As = r.detail!.longitudinal.As_cm2 * 1e-4;
    expect(r.Nrd_kN).toBeCloseTo((0.85 * fcd * r.Ac_m2 + As * 420) * 1000, 6);
  });

  it("flexo-compressão: Md = max(Msd, Nd·(0,015 + 0,03·D)) e MRd ≥ Md", () => {
    const centered = designPileReinforcement({
      pileTypeId: 6,
      diameter_m: 0.3,
      tipDepth_m: 4,
      Nk_kN: 200,
      loadIsDesign: true,
    });
    const withM = designPileReinforcement({
      pileTypeId: 6,
      diameter_m: 0.3,
      tipDepth_m: 4,
      Nk_kN: 200,
      Mk_kNm: 40,
      loadIsDesign: true,
    });
    expect(withM.nm?.mode).toBe("nm");
    expect(withM.As_nec_cm2).toBeGreaterThan(centered.As_nec_cm2 - 1e-9);
    expect(withM.nm!.Msd_kNm).toBeCloseTo(40, 6);
    expect(withM.nm!.Md_kNm).toBeCloseTo(40, 6);
    expect(withM.nm!.MRd_kNm).toBeGreaterThanOrEqual(withM.nm!.Md_kNm - 1e-6);
    // momento pequeno: governa o mínimo de 1ª ordem
    const small = designPileReinforcement({
      pileTypeId: 6,
      diameter_m: 0.3,
      tipDepth_m: 4,
      Nk_kN: 500,
      Mk_kNm: 1,
      loadIsDesign: true,
    });
    expect(small.nm!.Md_kNm).toBeCloseTo(500 * (0.015 + 0.03 * 0.3), 9);
  });

  it("cortante: Vc = 0,6·fctd·bw·d no quadrado equivalente (Modelo I)", () => {
    const r = designPileReinforcement({
      pileTypeId: 6,
      diameter_m: 0.4,
      tipDepth_m: 8,
      Nk_kN: 400,
      Mk_kNm: 10,
      Vk_kN: 60,
      loadIsDesign: true,
    });
    const b = Math.sqrt(Math.PI / 4) * 0.4;
    const t = r.detail!.transverse.diameter_mm / 1000;
    const d = b - 0.04 - t - r.detail!.longitudinal.diameter_mm / 2000;
    const fctd = (0.21 * Math.pow(25, 2 / 3)) / 3.1;
    expect(r.nm!.Vc_kN).toBeCloseTo(0.6 * fctd * b * d * 1000, 6);
    expect(r.nm!.shearOk).toBe(true);
  });

  it("estribo: s ≤ 12φℓ para CA-50", () => {
    const r = designPileReinforcement({ pileTypeId: 6, diameter_m: 0.5, tipDepth_m: 8, Nk_kN: 1500 });
    expect(r.detail!.transverse.spacing_m).toBeLessThanOrEqual((12 * r.detail!.longitudinal.diameter_mm) / 1000 + 1e-9);
  });

  it("madeira → not_applicable", () => {
    expect(designPileReinforcement({ pileTypeId: 3, diameter_m: 0.3, tipDepth_m: 8, Nk_kN: 200 }).status).toBe(
      "not_applicable",
    );
  });
});
