import { describe, expect, it } from "vitest";
import {
  defaultSpacing_m,
  designPileCap,
  layoutRectangularGrid,
  proposeRectangularCap,
  suggestEfficiencyConverseLabarre,
} from "../../block-engine/index";

describe("block-engine layout", () => {
  it("grade 2×2 centrada", () => {
    const piles = layoutRectangularGrid(2, 2, 1);
    expect(piles).toHaveLength(4);
    const xs = piles.map((p) => p.position.x_m).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(-0.5, 9);
    expect(xs[3]).toBeCloseTo(0.5, 9);
  });

  it("espaçamento default max(k·D, 0,8)", () => {
    expect(defaultSpacing_m(0.3)).toBeCloseTo(0.8, 9);
    expect(defaultSpacing_m(0.5)).toBeCloseTo(1.25, 9);
  });
});

describe("block-engine cap + design", () => {
  it("propõe bloco com beiral", () => {
    const piles = layoutRectangularGrid(1, 2, 1.2);
    const cap = proposeRectangularCap(piles, 0.2, 0.3);
    // estacas em x=±0.6, raio 0.15 → ±0.75 + 0.2
    expect(cap.width_m).toBeCloseTo(1.9, 6);
  });

  it("designPileCap: n×Padm indicativo sem η (DEC-17)", () => {
    const r = designPileCap({
      rows: 2,
      cols: 2,
      spacing_m: 1.0,
      diameter_m: 0.3,
      edge_m: 0.25,
      thickness_m: 0.5,
      singlePadm_kN: 200,
      groupLoad_kN: 700,
    });
    expect(r.pileCount).toBe(4);
    expect(r.groupPadm_kN).toBeCloseTo(800, 6);
    expect(r.groupCapacityIndicative).toBe(true);
    expect(r.efficiencyUserProvided).toBe(false);
    expect(r.capacityOk).toBeNull();
    expect(r.checks.find((c) => c.id === "capacity")?.status).toBe("warning");
    expect(r.checks.find((c) => c.id === "spacing")?.status).toBe("ok");
    expect(r.traces.length).toBeGreaterThan(0);
  });

  it("designPileCap: com η do usuário libera veredito capacityOk", () => {
    const r = designPileCap({
      rows: 2,
      cols: 2,
      spacing_m: 1.0,
      diameter_m: 0.3,
      edge_m: 0.25,
      thickness_m: 0.5,
      singlePadm_kN: 200,
      // + peso do bloco: 25 × 1,8 × 1,8 × 0,5 = 40,5 kN → 690,5 kN ≤ 720 kN
      groupLoad_kN: 650,
      efficiency: 0.9,
    });
    expect(r.groupPadm_kN).toBeCloseTo(720, 6);
    expect(r.pileLoads_kN[0]).toBeCloseTo(690.5 / 4, 6);
    expect(r.groupCapacityIndicative).toBe(false);
    expect(r.efficiencyUserProvided).toBe(true);
    expect(r.capacityOk).toBe(true);
    expect(r.checks.find((c) => c.id === "capacity")?.status).toBe("ok");
  });

  it("suggestEfficiencyConverseLabarre: 2×2 D=0,3 s=1", () => {
    const { eta, theta_deg } = suggestEfficiencyConverseLabarre({
      rows: 2,
      cols: 2,
      diameter_m: 0.3,
      spacing_m: 1.0,
    });
    // θ = arctg(0,3) = 16,699° ; η = 1 − θ·[(n−1)m + (m−1)n]/(90mn) = 1 − 16,699·4/360
    expect(theta_deg).toBeCloseTo(16.699, 3);
    expect(eta).toBeCloseTo(0.81446, 4);
  });

  it("suggestEfficiencyConverseLabarre: 1 estaca → η=1", () => {
    expect(
      suggestEfficiencyConverseLabarre({ rows: 1, cols: 1, diameter_m: 0.4, spacing_m: 1 }).eta,
    ).toBe(1);
  });

  it("marca erro se espaçamento insuficiente", () => {
    const r = designPileCap({
      rows: 2,
      cols: 1,
      spacing_m: 0.5,
      diameter_m: 0.4,
      edge_m: 0.2,
      thickness_m: 0.5,
    });
    expect(r.checks.find((c) => c.id === "spacing")?.status).toBe("error");
  });

  it("espaçamento mínimo: 3D moldada in loco, 2,5D pré-moldada", () => {
    const base = { rows: 1, cols: 2, spacing_m: null, diameter_m: 0.5, edge_m: 0.25, thickness_m: 0.8 };
    expect(designPileCap({ ...base, pileTypeId: 6 }).spacingMin_m).toBeCloseTo(1.5, 9);
    expect(designPileCap({ ...base, pileTypeId: 2 }).spacingMin_m).toBeCloseTo(1.25, 9);
  });

  it("Blévot, 2 estacas: T = Nd·(2e − a)/(8d), conferido à mão", () => {
    // Nk = 1000 → Nd = 1400 ; e = 1,2 ; pilar 0,30 (x) × 0,50 ; h = 0,8 → d = 0,7
    const r = designPileCap({
      rows: 1,
      cols: 2,
      spacing_m: 1.2,
      diameter_m: 0.4,
      edge_m: 0.25,
      thickness_m: 0.8,
      groupLoad_kN: 1000,
      columnWidth_m: 0.3,
      columnDepth_m: 0.5,
      fck_MPa: 25,
      fyk_MPa: 500,
    });
    const st = r.strutTie!;
    expect(st.Tx_kN).toBeCloseTo((1400 * (2 * 1.2 - 0.3)) / (8 * 0.7), 6); // 525 kN
    expect(st.AsX_cm2).toBeCloseTo((525 / (500 / 1.15)) * 10, 4); // 12,075 cm²
    expect(st.thetaMin_deg).toBeCloseTo((Math.atan(0.7 / (0.6 - 0.075)) * 180) / Math.PI, 6); // 53,13°
    // σ pilar = Nd/(Ap·sen²θ) = 1400/(0,15·0,64) kPa
    expect(st.sigmaColumn_MPa).toBeCloseTo(1400 / (0.15 * 0.64 * 1000), 4);
    expect(st.sigmaLimit_MPa).toBeCloseTo(1.4 * 0.85 * (25 / 1.4), 9);
    expect(st.rigid).toBe(true);
    expect(st.ok).toBe(true);
    expect(r.rebar!.tieX.As_cm2).toBeGreaterThanOrEqual(st.AsX_cm2);
    expect(r.punching).toBeNull();
  });

  it("Blévot: pilar pequeno demais reprova a biela", () => {
    const r = designPileCap({
      rows: 1,
      cols: 2,
      spacing_m: 1.2,
      diameter_m: 0.4,
      edge_m: 0.25,
      thickness_m: 0.8,
      groupLoad_kN: 1000,
      columnWidth_m: 0.3,
      columnDepth_m: 0.3,
      fck_MPa: 25,
    });
    expect(r.strutTie!.ok).toBe(false);
    expect(r.checks.find((c) => c.id === "strut")?.status).toBe("error");
  });

  it("bloco flexível: verifica punção (NBR 6118 19.5)", () => {
    const r = designPileCap({
      rows: 2,
      cols: 2,
      spacing_m: 1.5,
      diameter_m: 0.5,
      edge_m: 0.3,
      thickness_m: 0.5,
      groupLoad_kN: 2000,
      columnWidth_m: 0.4,
      columnDepth_m: 0.4,
      fck_MPa: 25,
    });
    expect(r.strutTie!.rigid).toBe(false);
    expect(r.punching).not.toBeNull();
    expect(r.checks.find((c) => c.id === "punching")).toBeDefined();
  });

  it("momentos no pilar redistribuem as reações (bloco rígido)", () => {
    const r = designPileCap({
      rows: 1,
      cols: 2,
      spacing_m: 1.2,
      diameter_m: 0.4,
      edge_m: 0.25,
      thickness_m: 0.8,
      groupLoad_kN: 600,
      My_kNm: 120,
      singlePadm_kN: 500,
    });
    const W = 25 * 2.1 * 0.9 * 0.8;
    // Ni = (N + W)/2 ± My·x/Σx² ; x = ±0,6 → Σx² = 0,72
    expect(Math.max(...r.pileLoads_kN)).toBeCloseTo((600 + W) / 2 + (120 * 0.6) / 0.72, 6);
  });
});
