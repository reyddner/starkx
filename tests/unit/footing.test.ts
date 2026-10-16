import { describe, expect, it } from "vitest";
import {
  bearingFactorsVesic,
  designFooting,
  ultimateBearing_kPa,
} from "../../footing-engine/index";

describe("footing-engine Vesic factors", () => {
  it("φ=0 → Nc≈5.14", () => {
    const f = bearingFactorsVesic(0);
    expect(f.Nc).toBeCloseTo(5.14, 2);
    expect(f.Nq).toBe(1);
  });

  it("φ=30° → Nq ≈ 18.4", () => {
    const f = bearingFactorsVesic(30);
    expect(f.Nq).toBeCloseTo(18.4, 0);
    expect(f.Nc).toBeGreaterThan(25);
    expect(f.Ngamma).toBeGreaterThan(10);
  });
});

describe("designFooting", () => {
  it("modo user — área pela carga de serviço: A = Nk/σadm", () => {
    const r = designFooting({
      Nk_kN: 1000,
      shape: "square",
      admMode: "user",
      sigmaAdm_kPa: 200,
      gammaConcrete_kN_m3: 0,
    });
    expect(r.area_m2).toBeCloseTo(5, 4);
    expect(r.B_m).toBeCloseTo(Math.sqrt(5), 4);
    expect(r.Nd_kN).toBeCloseTo(1400, 9);
    expect(r.checks.find((c) => c.id === "pressure")?.status).toBe("ok");
  });

  it("carga de cálculo informada é convertida em serviço (÷ 1,4) na geotecnia", () => {
    const r = designFooting({
      Nk_kN: 1400,
      loadIsDesign: true,
      shape: "square",
      admMode: "user",
      sigmaAdm_kPa: 200,
      gammaConcrete_kN_m3: 0,
    });
    expect(r.Nk_kN).toBeCloseTo(1000, 9);
    expect(r.area_m2).toBeCloseTo(5, 4);
  });

  it("modo bearing — converge e respeita FS", () => {
    const r = designFooting({
      Nk_kN: 800,
      shape: "square",
      admMode: "bearing",
      soil: {
        c_kPa: 0,
        phi_deg: 30,
        gamma_kN_m3: 18,
        embedment_m: 1.5,
        fsBearing: 3,
      },
      gammaConcrete_kN_m3: 0,
    });
    expect(r.qult_kPa).not.toBeNull();
    expect(r.qadm_kPa).toBeCloseTo(r.qult_kPa! / 3, 5);
    expect(r.sigmaAvg_kPa).toBeLessThanOrEqual(r.qadm_kPa + 1e-3);
    expect(r.factors?.Nq).toBeGreaterThan(10);
  });

  it("momento: amplia até σmáx ≤ σadm (B³ − 5B − 6 = 0 → B ≈ 2,689 m)", () => {
    // N/B²·(1 + 6e/B) = 200 com N = 1000 e e = 0,2
    const r = designFooting({
      Nk_kN: 1000,
      shape: "square",
      admMode: "user",
      sigmaAdm_kPa: 200,
      My_kNm: 200,
      gammaConcrete_kN_m3: 0,
    });
    expect(r.sigmaMax_kPa).toBeLessThanOrEqual(200 + 1e-6);
    expect(r.B_m).toBeGreaterThanOrEqual(2.689);
    expect(r.B_m).toBeLessThan(2.689 * 1.011);
    expect(r.checks.every((c) => c.status !== "error")).toBe(true);
  });

  it("excentricidade grande: amplia até a base toda comprimida (B ≥ 6e)", () => {
    const r = designFooting({
      Nk_kN: 500,
      shape: "square",
      admMode: "user",
      sigmaAdm_kPa: 250,
      My_kNm: 400,
      gammaConcrete_kN_m3: 0,
    });
    expect(r.B_m).toBeGreaterThanOrEqual(6 * 0.8 - 1e-6);
    expect(r.checks.find((c) => c.id === "kern")?.status).toBe("ok");
  });

  it("flexão oblíqua: núcleo central em losango (6ex/B + 6ey/L ≤ 1)", () => {
    const r = designFooting({
      Nk_kN: 1000,
      shape: "square",
      admMode: "user",
      sigmaAdm_kPa: 300,
      Mx_kNm: 150,
      My_kNm: 150,
      gammaConcrete_kN_m3: 0,
    });
    expect((6 * r.ex_m) / r.B_m + (6 * r.ey_m) / r.L_m).toBeLessThanOrEqual(1 + 1e-9);
    expect(r.sigmaMax_kPa).toBeLessThanOrEqual(300 + 1e-6);
  });

  it("qult cresce com B (termo Nγ)", () => {
    const a = ultimateBearing_kPa({ c_kPa: 0, phi_deg: 30, gamma_kN_m3: 18, Df_m: 1, B_m: 1, L_m: 1 });
    const b = ultimateBearing_kPa({ c_kPa: 0, phi_deg: 30, gamma_kN_m3: 18, Df_m: 1, B_m: 2, L_m: 2 });
    expect(b.qult_kPa).toBeGreaterThan(a.qult_kPa);
  });

  it("estrutural: sapata rígida e flexão CEB-70 conferida à mão", () => {
    // Nk = 2000, σadm = 500 → B = 2 m ; pilar 0,30 → h ≥ (2 − 0,3)/3 = 0,567 → 0,60 m ; d = 0,55
    // σd = 1,4·2000/4 = 700 kPa ; x = 0,85 + 0,15·0,3 = 0,895 m
    // M = 700·2·0,895²/2 = 560,7 kN·m ; As = M/(0,85·d·fyd) = 27,59 cm² → 13,79 cm²/m
    const r = designFooting({
      Nk_kN: 2000,
      shape: "square",
      admMode: "user",
      sigmaAdm_kPa: 500,
      gammaConcrete_kN_m3: 0,
      fck_MPa: 25,
      columnWidth_m: 0.3,
      columnDepth_m: 0.3,
    });
    expect(r.B_m).toBeCloseTo(2, 6);
    expect(r.thickness_m).toBeCloseTo(0.6, 9);
    expect(r.rigid).toBe(true);
    const M = (700 * 2 * 0.895 ** 2) / 2;
    const AsPerM = ((M / (0.85 * 0.55 * (500 / 1.15) * 1000)) * 1e4) / 2;
    expect(r.rebar!.AsB_cm2_per_m).toBeCloseTo(AsPerM, 6);
    // biela no contorno do pilar: τ = 2800/(1,2·0,55) kPa ≤ 0,27·0,9·25/1,4
    const strut = r.checks.find((c) => c.id === "strut")!;
    expect(strut.value).toBeCloseTo(2800 / (1.2 * 0.55 * 1000), 6);
    expect(strut.status).toBe("ok");
  });

  it("sapata flexível (h informada) recebe verificação de punção", () => {
    const r = designFooting({
      Nk_kN: 2000,
      shape: "square",
      admMode: "user",
      sigmaAdm_kPa: 500,
      gammaConcrete_kN_m3: 0,
      thickness_m: 0.4,
      fck_MPa: 25,
    });
    expect(r.rigid).toBe(false);
    expect(r.checks.find((c) => c.id === "punching")).toBeDefined();
  });
});
