import { describe, expect, it } from "vitest";
import { bearingFactorsVesic, ultimateBearing_kPa } from "../../footing-engine/index";

describe("Vesic (1975) — fatores de capacidade de carga", () => {
  it("φ = 30°: Nc = 30,14 ; Nq = 18,40 ; Nγ = 22,40 (tabela da literatura)", () => {
    const f = bearingFactorsVesic(30);
    expect(f.Nc).toBeCloseTo(30.14, 2);
    expect(f.Nq).toBeCloseTo(18.4, 2);
    expect(f.Ngamma).toBeCloseTo(22.4, 2);
  });

  it("φ = 0: Nc = 5,14 ; Nq = 1 ; Nγ = 0", () => {
    const f = bearingFactorsVesic(0);
    expect(f.Nc).toBeCloseTo(5.14, 2);
    expect(f.Nq).toBe(1);
    expect(f.Ngamma).toBe(0);
  });

  it("qult de sapata quadrada calculado à mão", () => {
    // c=10, φ=30°, γ=18, Df=1, B=L=2: sc = 1 + Nq/Nc, sq = 1 + tg φ, sγ = 0,6
    const Nc = 30.1396, Nq = 18.4011, Ng = 22.4020;
    const hand = 10 * Nc * (1 + Nq / Nc) + 18 * 1 * Nq * (1 + Math.tan(Math.PI / 6)) + 0.5 * 18 * 2 * Ng * 0.6;
    const u = ultimateBearing_kPa({ c_kPa: 10, phi_deg: 30, gamma_kN_m3: 18, Df_m: 1, B_m: 2, L_m: 2 });
    expect(u.qult_kPa).toBeCloseTo(hand, 1);
  });
});
