import { beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "../../apps/web/src/store/projectStore";

describe("concepção automática no store", () => {
  beforeEach(() => {
    useProjectStore.getState().resetBlankProject();
  });

  it("runConceptionAndApply preenche Ø, L e n a partir de SPT + carga", () => {
    useProjectStore.getState().loadReferenceExample();
    useProjectStore.getState().patch({
      mode: "engineering",
      designLoad_kN: 400,
      columnLoad: {
        ...useProjectStore.getState().columnLoad,
        N_kN: 400,
      },
    });

    useProjectStore.getState().runConceptionAndApply();

    const s = useProjectStore.getState();
    expect(s.conceptionResult).not.toBeNull();
    expect(s.conceptionResult!.recommended).not.toBeNull();
    expect(s.diameterCm).toBe(s.conceptionResult!.recommended!.diameterCm);
    // L pode ser ajustado ao datum do bloco (DEC-57 snap) — não precisa igualar o candidato cru.
    expect(s.tipDepth_m).toBeGreaterThan(0);
    expect(s.foundationKind).toBe("pile_cap");
    expect(s.blockResult).not.toBeNull();
    expect(s.blockRows * s.blockCols).toBe(s.conceptionResult!.recommended!.nPiles);
    expect(s.result).not.toBeNull();
    expect(s.calcError).toBeNull();
  });

  it("acceptFoundationSuggestion aplica concepção quando tipo é estaca", () => {
    useProjectStore.getState().loadReferenceExample();
    useProjectStore.getState().runFoundationAnalysis();
    const before = useProjectStore.getState().conceptionResult;
    expect(before).not.toBeNull();

    useProjectStore.getState().acceptFoundationSuggestion();
    const s = useProjectStore.getState();
    expect(s.analysisAccepted).toBe(true);
    expect(s.step).toBe("foundation");
    if (s.foundationKind === "pile" || s.foundationKind === "pile_cap") {
      expect(s.conceptionResult?.recommended).not.toBeNull();
      expect(s.result).not.toBeNull();
    }
  });
});
