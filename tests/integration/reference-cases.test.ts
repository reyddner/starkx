import { describe, expect, it } from "vitest";
import { calculate } from "@engine/index";
import type { MethodId } from "@engine/types";
import reference from "../fixtures/reference-cases.json";

/**
 * Motor × oráculo independente (tools/reference/pile_capacity.py), pelas fórmulas publicadas
 * de Aoki-Velloso (1975), Décourt-Quaresma (1978/1996) e Teixeira (1996).
 */
function close(actual: number, expected: number, label: string) {
  expect(Math.abs(actual - expected), label).toBeLessThanOrEqual(1e-6 * Math.max(1, Math.abs(expected)));
}

describe("casos de referência — motor × fórmulas publicadas", () => {
  for (const c of reference.cases) {
    it(`${c.id}: ${c.title}`, () => {
      const r = calculate(c.input as Parameters<typeof calculate>[0]);
      for (const m of r.atTip.methods) {
        const exp = c.expected.methods[m.methodId as MethodId];
        close(m.Rp_kN, exp.Rp_kN, `${m.methodId}.Rp`);
        close(m.Rl_acum_kN, exp.Rl_acum_kN, `${m.methodId}.Rl`);
        close(m.Rult_kN, exp.Rult_kN, `${m.methodId}.Rult`);
        close(m.Padm_kN, exp.Padm_kN, `${m.methodId}.Padm`);
      }
      close(r.atTip.averagePadm_kN, c.expected.averagePadm_kN, "média");
      close(r.atTip.minimumPadm_kN, c.expected.minimumPadm_kN, "mínimo");
      // regra padrão: mínimo dos métodos
      close(r.atTip.governingPadm_kN, c.expected.minimumPadm_kN, "governante");
    });
  }

  it("perfil: Padm na cota de apoio = último ponto do perfil e Rl cresce com a profundidade", () => {
    const c = reference.cases[0]!;
    const r = calculate(c.input as Parameters<typeof calculate>[0]);
    const last = r.profile[r.profile.length - 1]!;
    expect(last.aoki!.Padm_kN).toBeCloseTo(r.atTip.methods[0]!.Padm_kN, 9);
    for (let i = 1; i < r.profile.length; i++) {
      expect(r.profile[i]!.teixeira!.Rl_acum_kN).toBeGreaterThanOrEqual(r.profile[i - 1]!.teixeira!.Rl_acum_kN);
      expect(r.profile[i]!.aoki!.Rl_acum_kN).toBeGreaterThanOrEqual(r.profile[i - 1]!.aoki!.Rl_acum_kN);
    }
  });
});
