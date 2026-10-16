import { beforeEach, describe, expect, it } from "vitest";
import {
  deriveProjectStatus,
  displayProjectName,
  foundationKindLabel,
  statusLabel,
  useLibraryStore,
} from "../../apps/web/src/store/projectLibrary";
import { useProjectStore } from "../../apps/web/src/store/projectStore";
import {
  createAndOpenProject,
  openLibraryProject,
  captureWorkspaceSnapshot,
} from "../../apps/web/src/store/workspaceBridge";

describe("DEC-50 project library", () => {
  beforeEach(() => {
    useLibraryStore.setState({
      projects: [],
      activeProjectId: null,
      shellView: "dashboard",
    });
    useProjectStore.getState().resetBlankProject();
  });

  it("displayProjectName nunca mostra vazio", () => {
    expect(displayProjectName("")).toBe("Projeto sem nome");
    expect(displayProjectName("  ")).toBe("Projeto sem nome");
    expect(displayProjectName("Residência Família Silva")).toBe("Residência Família Silva");
  });

  it("deriveProjectStatus: draft → in_progress → complete", () => {
    expect(deriveProjectStatus({ projectName: "" })).toBe("draft");
    expect(deriveProjectStatus({ projectName: "A", layers: [{ depth_m: 1 }] })).toBe(
      "in_progress",
    );
    expect(
      deriveProjectStatus({
        projectName: "A",
        layers: [],
        designLoad_kN: 100,
      }),
    ).toBe("in_progress");
    expect(deriveProjectStatus({ hasCapacityHint: true })).toBe("complete");
  });

  it("foundationKindLabel e statusLabel em pt-BR", () => {
    expect(foundationKindLabel("pile_cap")).toBe("Bloco sobre estacas");
    expect(statusLabel("in_progress")).toBe("Em andamento");
  });

  it("createAndOpenProject abre workspace e registra na biblioteca", () => {
    createAndOpenProject({ name: "Residência Família Silva", client: "Silva" });
    const lib = useLibraryStore.getState();
    expect(lib.shellView).toBe("workspace");
    expect(lib.projects).toHaveLength(1);
    expect(lib.projects[0]!.name).toBe("Residência Família Silva");
    expect(lib.activeProjectId).toBe(lib.projects[0]!.id);
    expect(useProjectStore.getState().projectName).toBe("Residência Família Silva");
    expect(useProjectStore.getState().step).toBe("project");
  });

  it("openLibraryProject hidrata payload sem resultados de motor", () => {
    createAndOpenProject({ name: "Obra A" });
    useProjectStore.getState().patch({ tipDepth_m: 8, location: "Campinas" });
    useLibraryStore.getState().saveActivePayload(captureWorkspaceSnapshot());
    const id = useLibraryStore.getState().activeProjectId!;

    createAndOpenProject({ name: "Obra B" });
    expect(useProjectStore.getState().projectName).toBe("Obra B");

    expect(openLibraryProject(id)).toBe(true);
    expect(useProjectStore.getState().projectName).toBe("Obra A");
    expect(useProjectStore.getState().tipDepth_m).toBe(8);
    expect(useProjectStore.getState().location).toBe("Campinas");
    expect(useProjectStore.getState().result).toBeNull();
  });

  it("openLibraryProject com step abre em Dados do projeto", () => {
    createAndOpenProject({ name: "Obra Edit" });
    useProjectStore.getState().setStep("borehole");
    useLibraryStore.getState().saveActivePayload(captureWorkspaceSnapshot());
    const id = useLibraryStore.getState().activeProjectId!;

    createAndOpenProject({ name: "Outra" });
    expect(openLibraryProject(id, { step: "project" })).toBe(true);
    expect(useProjectStore.getState().projectName).toBe("Obra Edit");
    expect(useProjectStore.getState().step).toBe("project");
  });

  it("loadReferenceExample preserva nome amigável já cadastrado", () => {
    createAndOpenProject({
      name: "Residência Família Silva",
      client: "Silva",
      location: "Campinas",
      code: "OB-1",
    });
    useProjectStore.getState().loadReferenceExample();
    const s = useProjectStore.getState();
    expect(s.projectName).toBe("Residência Família Silva");
    expect(s.client).toBe("Silva");
    expect(s.location).toBe("Campinas");
    expect(s.projectCode).toBe("OB-1");
    expect(s.layers.length).toBeGreaterThan(0);
    expect(s.result).not.toBeNull();
  });
});
