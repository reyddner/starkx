import { describe, expect, it } from "vitest";
import { designCaisson } from "../../caisson-engine/index";
import { designRaft } from "../../raft-engine/index";

describe("caisson-engine", () => {
  it("modo user — só ponta", () => {
    const r = designCaisson({
      Nk_kN: 2000,
      loadIsDesign: true,
      shaftDiameter_m: 1.2,
      length_m: 8,
      admMode: "user",
      sigmaAdm_kPa: 400,
      unitFriction_kPa: 0,
    });
    const Ap = (Math.PI * 1.2 * 1.2) / 4;
    expect(r.Rp_adm_kN).toBeCloseTo(400 * Ap, 1);
    expect(r.Rl_adm_kN).toBe(0);
    expect(r.Padm_kN).toBeCloseTo(r.Rp_adm_kN, 5);
    expect(r.rebar).toBeNull();
  });

  it("fuste com atrito unitário aumenta Padm", () => {
    const base = designCaisson({
      Nk_kN: 1000,
      loadIsDesign: true,
      shaftDiameter_m: 1,
      length_m: 10,
      admMode: "user",
      sigmaAdm_kPa: 300,
      unitFriction_kPa: 0,
    });
    const withShaft = designCaisson({
      Nk_kN: 1000,
      loadIsDesign: true,
      shaftDiameter_m: 1,
      length_m: 10,
      admMode: "user",
      sigmaAdm_kPa: 300,
      unitFriction_kPa: 40,
      shaftFS: 1.5,
    });
    expect(withShaft.Padm_kN).toBeGreaterThan(base.Padm_kN);
    expect(withShaft.Rl_adm_kN).toBeCloseTo((40 * Math.PI * 1 * 10) / 1.5, 1);
  });

  it("bearing Vesic circular", () => {
    const r = designCaisson({
      Nk_kN: 1500,
      loadIsDesign: true,
      shaftDiameter_m: 1,
      baseDiameter_m: 1.5,
      length_m: 6,
      admMode: "bearing",
      soil: { c_kPa: 0, phi_deg: 30, gamma_kN_m3: 18, fsTip: 3 },
      unitFriction_kPa: 0,
    });
    expect(r.qult_kPa).not.toBeNull();
    expect(r.Padm_kN).toBeGreaterThan(0);
    expect(r.baseDiameter_m).toBe(1.5);
  });

  it("fuste spt_aoki aumenta Rl vs fs=0 (DEC-22)", () => {
    const layers = [
      { depth_m: 1, nspt: 10, soilTypeId: 12 },
      { depth_m: 2, nspt: 12, soilTypeId: 12 },
      { depth_m: 3, nspt: 15, soilTypeId: 12 },
      { depth_m: 4, nspt: 18, soilTypeId: 7 },
    ];
    const tipOnly = designCaisson({
      Nk_kN: 1000,
      loadIsDesign: true,
      shaftDiameter_m: 1,
      length_m: 4,
      admMode: "user",
      sigmaAdm_kPa: 300,
      shaftMode: "user",
      unitFriction_kPa: 0,
    });
    const withSpt = designCaisson({
      Nk_kN: 1000,
      loadIsDesign: true,
      shaftDiameter_m: 1,
      length_m: 4,
      admMode: "user",
      sigmaAdm_kPa: 300,
      shaftMode: "spt_aoki",
      shaftFS: 1.5,
      sptLayers: layers,
    });
    expect(withSpt.shaftMode).toBe("spt_aoki");
    expect(withSpt.Rl_adm_kN).toBeGreaterThan(0);
    expect(withSpt.Padm_kN).toBeGreaterThan(tipOnly.Padm_kN);
    expect(withSpt.avgFsShaft_kPa).not.toBeNull();
  });

  it("As,mín orientativa com fck (DEC-25)", () => {
    const r = designCaisson({
      Nk_kN: 2000,
      loadIsDesign: true,
      shaftDiameter_m: 1.2,
      length_m: 8,
      admMode: "user",
      sigmaAdm_kPa: 400,
      unitFriction_kPa: 0,
      fck_MPa: 25,
    });
    expect(r.rebar).not.toBeNull();
    expect(r.rebar!.As_min_cm2).toBeGreaterThan(0);
    expect(r.rebar!.suggestCount).toBeGreaterThanOrEqual(6);
    expect(r.traces.some((t) => t.stepId === "rebar.min")).toBe(true);
  });
});

describe("raft-engine", () => {
  it("dimensiona retangular com σadm", () => {
    const r = designRaft({
      Nk_kN: 5000,
      aspectRatio: 2,
      admMode: "user",
      sigmaAdm_kPa: 150,
      gammaConcrete_kN_m3: 0,
    });
    expect(r.kind).toBe("raft");
    expect(r.area_m2).toBeCloseTo(5000 / 150, 1);
    expect(r.L_m / r.B_m).toBeCloseTo(2, 2);
    expect(r.thicknessSuggested_m).toBeCloseTo(Math.max(0.4, r.B_m / 10), 2);
  });
});

describe("caisson-engine — serviço × cálculo, fuste e base", () => {
  it("capacidade admissível compara com a carga de serviço (Nk), não com Nd", () => {
    // Ap(Ø1,2) = 1,131 m² × 400 kPa = 452,4 kN ; Nk = 420 kN atende, Nd = 588 kN não entra na geotecnia
    const r = designCaisson({
      Nk_kN: 420,
      shaftDiameter_m: 1.2,
      length_m: 8,
      admMode: "user",
      sigmaAdm_kPa: 400,
      unitFriction_kPa: 0,
    });
    expect(r.checks.find((c) => c.id === "capacity")?.status).toBe("ok");
    expect(r.Nd_kN).toBeCloseTo(588, 9);
  });

  it("fuste de concreto: σd = Nd/As ≤ 0,85·fck/3,1", () => {
    const base = {
      shaftDiameter_m: 0.8,
      baseDiameter_m: 2.0,
      length_m: 8,
      admMode: "user" as const,
      sigmaAdm_kPa: 1000,
      unitFriction_kPa: 0,
    };
    // Nk = 3000 → Nd = 4200 → σd = 8,36 MPa > 6,85 MPa
    expect(designCaisson({ ...base, Nk_kN: 3000 }).checks.find((c) => c.id === "shaft_concrete")?.status).toBe("error");
    const r = designCaisson({
      Nk_kN: 2000,
      shaftDiameter_m: 0.8,
      baseDiameter_m: 2.0,
      length_m: 8,
      admMode: "user",
      sigmaAdm_kPa: 1000,
      unitFriction_kPa: 0,
    });
    const shaft = r.checks.find((c) => c.id === "shaft_concrete")!;
    expect(shaft.value).toBeCloseTo((2800 / (Math.PI * 0.64 / 4)) / 1000, 6);
    expect(shaft.limit).toBeCloseTo(0.85 * 25 / 3.1, 9);
    expect(shaft.status).toBe("ok");
  });

  it("base alargada: H = (Db − Ds)/2·tg 60° e sem atrito no alargamento", () => {
    const r = designCaisson({
      Nk_kN: 1000,
      shaftDiameter_m: 0.8,
      baseDiameter_m: 2.0,
      length_m: 8,
      admMode: "user",
      sigmaAdm_kPa: 400,
      unitFriction_kPa: 20,
      shaftFS: 1.5,
    });
    const H = 0.6 * Math.tan(Math.PI / 3);
    expect(r.checks.find((c) => c.id === "bell")?.value).toBeCloseTo(H, 9);
    expect(r.Rl_adm_kN).toBeCloseTo((20 * Math.PI * 0.8 * (8 - H)) / 1.5, 6);
  });
});
