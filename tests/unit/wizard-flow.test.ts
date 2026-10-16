import { describe, expect, it } from "vitest";
import {
  canEnterStep,
  canRunCalculation,
  flowAnchorFor,
  flowForKind,
  isOffFlowStep,
  nextStepId,
  prevStepId,
  stepCompletion,
  type FlowGateInput,
} from "../../apps/web/src/store/wizardFlow";
import { suggestFoundationKind } from "../../assist-engine/foundationSuggest";
import { resizeColumns, createColumn, hasAnyColumnLoad } from "../../apps/web/src/store/columns";

const baseGate = (): FlowGateInput => ({
  step: "project",
  foundationKind: "pile",
  projectName: "T",
  layers: [
    { depth_m: 1, nspt: 10, soilTypeId: 12 },
    { depth_m: 2, nspt: 12, soilTypeId: 12 },
    { depth_m: 3, nspt: 14, soilTypeId: 12 },
    { depth_m: 4, nspt: 16, soilTypeId: 7 },
  ],
  waterLevel_m: null,
  pileTypeId: 6,
  diameterCm: 30,
  tipDepth_m: 4,
  blockThickness_m: 0.5,
  blockEmbedment_m: 0.1,
  pileTopElevation_m: 0,
  mode: "engineering",
  designLoad_kN: 150,
  hasColumnLoad: true,
  analysisAccepted: false,
  result: { ok: true },
  structural: null,
  blockResult: null,
  footingResult: null,
  caissonResult: null,
  raftResult: null,
  blockRows: 1,
  blockCols: 1,
});

describe("DEC-54 wizardFlow cargas-primeiro", () => {
  it("ordem: sondagem → cargas → análise → fundação (DEC-58)", () => {
    const ids = flowForKind("pile").map((s) => s.id);
    expect(ids.indexOf("borehole")).toBeLessThan(ids.indexOf("loads"));
    expect(ids.indexOf("loads")).toBeLessThan(ids.indexOf("analysis"));
    expect(ids.indexOf("analysis")).toBeLessThan(ids.indexOf("foundation"));
    expect(ids.indexOf("foundation")).toBeLessThan(ids.indexOf("results"));
  });

  it("NA e métodos saem do fluxo principal (DEC-58)", () => {
    const ids = flowForKind("pile").map((s) => s.id);
    expect(ids).not.toContain("groundwater");
    expect(ids).not.toContain("methods");
    expect(ids).not.toContain("pile");
    expect(isOffFlowStep("groundwater")).toBe(true);
    expect(isOffFlowStep("methods")).toBe(true);
    expect(flowAnchorFor("groundwater")).toBe("borehole");
    expect(flowAnchorFor("methods")).toBe("foundation");
    expect(flowAnchorFor("pile")).toBe("foundation");
  });

  it("permite cargas com sondagem sem capacidade", () => {
    const s = baseGate();
    s.result = null;
    expect(canEnterStep(s, "loads").ok).toBe(true);
  });

  it("bloqueia análise sem cargas", () => {
    const s = baseGate();
    s.hasColumnLoad = false;
    s.designLoad_kN = null;
    expect(canEnterStep(s, "analysis").ok).toBe(false);
  });

  it("permite calcular com sondagem + geometria + ponta", () => {
    expect(canRunCalculation(baseGate()).ok).toBe(true);
  });

  it("NA opcional: entrada livre, ✓ só com valor (DEC-39)", () => {
    const s = baseGate();
    expect(canEnterStep(s, "groundwater").ok).toBe(true);
    expect(stepCompletion(s, "groundwater")).toBe(false);
    s.waterLevel_m = 2;
    expect(stepCompletion(s, "groundwater")).toBe(true);
  });

  it("rasas: desenhos vêm após capacidade no fluxo", () => {
    const ids = flowForKind("footing").map((s) => s.id);
    expect(ids.indexOf("loads")).toBeLessThan(ids.indexOf("foundation"));
    expect(ids.indexOf("results")).toBeLessThan(ids.indexOf("drawings"));
    expect(ids.indexOf("drawings")).toBeLessThan(ids.indexOf("memorial"));
  });

  it("caminho principal não inclui cota, grupo nem armadura (avançado)", () => {
    const pile = flowForKind("pile").map((s) => s.id);
    const cap = flowForKind("pile_cap").map((s) => s.id);
    for (const extra of ["tip_sweep", "group", "rebar"] as const) {
      expect(pile).not.toContain(extra);
      expect(isOffFlowStep(extra)).toBe(true);
    }
    expect(cap).toContain("block");
    expect(cap).not.toContain("group");
  });

  it("Continuar a partir de etapa avançada não volta para o âncora", () => {
    const s = baseGate();
    s.step = "groundwater";
    expect(nextStepId(s)).toBe("loads");
    expect(prevStepId(s)).toBe("borehole");
    s.step = "methods";
    expect(nextStepId(s)).toBe("results");
    expect(prevStepId(s)).toBe("foundation");
  });
});

describe("DEC-54 foundationSuggest", () => {
  it("N alto sem sapata viável sugere pile_cap", () => {
    const r = suggestFoundationKind({
      columns: [{ id: "1", columnLabel: "P01", N_kN: 5000, Mx_kNm: null, My_kNm: null }],
      loadIsDesign: true,
      sigmaAdm_kPa: 200,
      maxFootingSide_m: 4,
    });
    expect(r.suggestedKind).toBe("pile_cap");
    expect(r.probes[0]!.footingOk).toBe(false);
  });

  it("N moderado com σadm alto sugere footing", () => {
    const r = suggestFoundationKind({
      columns: [{ id: "1", columnLabel: "P01", N_kN: 400, Mx_kNm: null, My_kNm: null }],
      loadIsDesign: true,
      sigmaAdm_kPa: 300,
      maxFootingSide_m: 4,
    });
    expect(r.suggestedKind).toBe("footing");
    expect(r.probes[0]!.footingOk).toBe(true);
    expect(r.probes[0]!.suggestedKind).toBe("footing");
  });

  it("pilares mistos: suggestedKind por pilar (DEC-55)", () => {
    const r = suggestFoundationKind({
      columns: [
        { id: "1", columnLabel: "P01", N_kN: 300, Mx_kNm: null, My_kNm: null },
        { id: "2", columnLabel: "P02", N_kN: 8000, Mx_kNm: null, My_kNm: null },
      ],
      loadIsDesign: true,
      sigmaAdm_kPa: 300,
      maxFootingSide_m: 4,
    });
    expect(r.probes).toHaveLength(2);
    expect(r.probes[0]!.suggestedKind).toBe("footing");
    expect(r.probes[1]!.suggestedKind).toBe("pile_cap");
    expect(r.suggestedKind).toBe("pile_cap");
    expect(r.reasons.some((x) => /DEC-55|distintas/i.test(x))).toBe(true);
  });

  it("solo raso fraco desfavorece sapata mesmo com σadm alto (DEC-56)", () => {
    const r = suggestFoundationKind({
      columns: [{ id: "1", columnLabel: "P01", N_kN: 400, Mx_kNm: null, My_kNm: null }],
      loadIsDesign: true,
      sigmaAdm_kPa: 300,
      layers: [
        { depth_m: 1, nspt: 2 },
        { depth_m: 2, nspt: 3 },
        { depth_m: 3, nspt: 4 },
      ],
      waterLevel_m: 1.2,
    });
    expect(r.soil.softShallow).toBe(true);
    expect(r.soil.highWaterTable).toBe(true);
    expect(r.probes[0]!.footingOk).toBe(false);
    expect(r.suggestedKind).toBe("pile_cap");
    expect(r.suggestedKind).not.toBe("pile");
    expect(r.alternatives).not.toContain("pile");
    expect(r.soil.sigmaAdmFromSpt_kPa).toBeGreaterThan(0);
  });

  it("σadm efetivo = min(user, SPT)", () => {
    const r = suggestFoundationKind({
      columns: [{ id: "1", columnLabel: "P01", N_kN: 200, Mx_kNm: null, My_kNm: null }],
      loadIsDesign: true,
      sigmaAdm_kPa: 400,
      layers: [
        { depth_m: 1, nspt: 10 },
        { depth_m: 2, nspt: 12 },
        { depth_m: 3, nspt: 11 },
      ],
    });
    // N̄≈11 → 20*11=220
    expect(r.soil.sigmaAdmFromSpt_kPa).toBe(220);
    expect(r.soil.sigmaAdmEffective_kPa).toBe(220);
  });
});

describe("DEC-54 resizeColumns", () => {
  it("cria P01…Pn ao aumentar", () => {
    const one = [createColumn({ columnLabel: "P01" })];
    const { columns } = resizeColumns(one, 3, one[0]!.id);
    expect(columns).toHaveLength(3);
    expect(hasAnyColumnLoad(columns, null)).toBe(false);
  });
});
