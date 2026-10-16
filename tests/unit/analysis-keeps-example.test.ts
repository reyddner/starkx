import { beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "../../apps/web/src/store/projectStore";

/** DEC-61: abrir a Análise depois do exemplo não troca o tipo nem apaga o cálculo. */
describe("Análise preserva o exemplo", () => {
  beforeEach(() => {
    useProjectStore.getState().resetBlankProject();
  });

  it("runFoundationAnalysis mantém estaca isolada e o resultado calculado", () => {
    useProjectStore.getState().loadReferenceExample();
    expect(useProjectStore.getState().result).not.toBeNull();

    useProjectStore.getState().runFoundationAnalysis();

    const s = useProjectStore.getState();
    expect(s.foundationKind).toBe("pile");
    expect(s.result).not.toBeNull();
    expect(s.foundationSuggestion).not.toBeNull();
  });
});
