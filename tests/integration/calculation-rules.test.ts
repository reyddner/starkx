import { describe, expect, it } from "vitest";
import { calculate } from "@engine/index";
import { clampTeixeiraN } from "@engine/soil/preprocess-spt";
import { refInput } from "../fixtures/reference";

const base = refInput as Parameters<typeof calculate>[0];

describe("regras dos métodos (literatura)", () => {
  const result = calculate(base);

  it("Décourt: α pela tabela no solo da ponta (silte arenoso × escavada = 60 %), β por camada", () => {
    const dq = result.atTip.methods.find((m) => m.methodId === "decourt_quaresma")!;
    expect(dq.extras?.alphaPct).toBe(60);
    expect(dq.extras?.betaPct).toBe("tabela");
  });

  it("Décourt: N̄L sem os SPT da ponta e do metro acima (3 ≤ N ≤ 15)", () => {
    const tip = result.profile.at(-1)!;
    // SPT 1..6 m: 3, 4, 6, 8, 10, 13 → média 7,333…
    expect(tip.spt.R).toBeCloseTo((3 + 4 + 6 + 8 + 10 + 13) / 6, 9);
    // Np: média do N a 7, 8 e 9 m
    expect(tip.spt.Q).toBeCloseTo((16 + 20 + 24) / 3, 9);
  });

  it("Décourt: atrito desde o primeiro metro (sem pular 2 m)", () => {
    const at1 = result.profile[0]!.decourt!;
    expect(at1.Rl_acum_kN).toBeGreaterThan(0);
  });

  it("Teixeira: N limitado a 4 ≤ N ≤ 40 (monótono)", () => {
    expect(clampTeixeiraN(2)).toBe(4);
    expect(clampTeixeiraN(40)).toBe(40);
    expect(clampTeixeiraN(41)).toBe(40);
    expect(clampTeixeiraN(60)).toBe(40);
  });

  it("governante padrão = mínimo dos métodos", () => {
    expect(result.atTip.governingPadm_kN).toBeCloseTo(result.atTip.minimumPadm_kN, 9);
  });
});

describe("comprimento e cota de ponta", () => {
  it("aceita comprimento fracionário com SPT na ponta", () => {
    const layers = [...base.layers, { depth_m: 3.5, nspt: 7, soilTypeId: 12 }].sort(
      (a, b) => a.depth_m - b.depth_m,
    );
    const r = calculate({ ...base, tipDepth_m: 3.5, layers, methods: ["aoki_velloso"] });
    expect(r.profile.at(-1)!.depth_m).toBeCloseTo(3.5, 6);
  });

  it("rejeita ponta sem camada SPT", () => {
    expect(() => calculate({ ...base, tipDepth_m: 7.5 })).toThrow(/cota de apoio/i);
  });
});

describe("método escolhido pelo usuário", () => {
  it("exige selectedMethod", () => {
    expect(() => calculate({ ...base, governingRule: "user_selected" })).toThrow(/selectedMethod/i);
  });

  it("adota o Padm do método escolhido (Teixeira)", () => {
    const r = calculate({ ...base, governingRule: "user_selected", selectedMethod: "teixeira" });
    const tx = r.atTip.methods.find((m) => m.methodId === "teixeira")!;
    expect(r.atTip.governingMethodId).toBe("teixeira");
    expect(r.atTip.governingPadm_kN).toBeCloseTo(tx.Padm_kN, 9);
  });
});
