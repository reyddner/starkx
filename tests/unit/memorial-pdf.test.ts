import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calculate } from "@engine/index";
import { refInput, refExpected } from "../fixtures/reference";
import {
  buildMemorialDocument,
  type MemorialInput,
} from "../../memorial-engine/index";
import { memorialToPdf } from "../../memorial-engine/toPdf";

describe("memorialToPdf", () => {
  it("gera PDF válido com fonte Roboto (DEC-26)", async () => {
    const geo = calculate({
      ...(refInput as Parameters<typeof calculate>[0]),
      mode: "engineering",
      governingRule: "minimum",
      designLoad_kN: 200,
    });
    const input: MemorialInput = {
      generatedAtIso: "2026-09-10T12:00:00.000Z",
      softwareVersion: "0.1.0",
      project: {
        name: "Exemplo",
        code: "EX-01",
        client: "Validação",
        location: "São Paulo",
      },
      pile: {
        typeLabel: "Escavada",
        diameter_cm: 30,
        tipDepth_m: 4,
      },
      site: { waterLevel_m: 42 },
      layers: [{ depth_m: 4, nspt: 21, soilLabel: "Argila arenosa" }],
      designLoad_kN: 200,
      methods: {
        mode: "engineering",
        governingRule: "minimum",
        aokiFs: 2,
        aokiPctTip: 100,
        aokiPctShaft: 100,
        decourtAlphaPct: null,
        decourtBetaPct: null,
        teixeiraFs: 2,
        teixeiraPctTip: 100,
        teixeiraPctShaft: 100,
      },
      geotechnical: geo,
      structural: null,
    };
    const doc = buildMemorialDocument(input);
    const fontBytes = new Uint8Array(
      readFileSync(join(process.cwd(), "memorial-engine/fonts/Roboto-Regular.ttf")),
    );
    const pdfBytes = await memorialToPdf(doc, { fontBytes });
    expect(pdfBytes.byteLength).toBeGreaterThan(1000);
    const head = String.fromCharCode(...pdfBytes.slice(0, 5));
    expect(head).toBe("%PDF-");
  });

  it("gera PDF completo com seções de dados gerais, cargas e medição", async () => {
    const { designPileReinforcement } = await import("@structural/index");
    const { storeToMemorialInput } = await import("../../apps/web/src/memorial/fromStore");

    const structural = designPileReinforcement({
      pileTypeId: 6,
      diameter_m: 0.40,
      tipDepth_m: 6.0,
      Nk_kN: 350,
      loadIsDesign: false,
    });

    const memInput = storeToMemorialInput({
      projectName: "Edifício Residencial Torre A",
      projectCode: "RES-01",
      client: "Construtora Alfa",
      location: "São Paulo - SP",
      pileTypeId: 6,
      diameterCm: 40,
      tipDepth_m: 6.0,
      areaCm2: "",
      perimeterCm: "",
      waterLevel_m: null,
      layers: [{ depth_m: 6, nspt: 25, soilTypeId: 1 }],
      designLoad_kN: 350,
      mode: "engineering",
      governingRule: "minimum",
      aokiFs: 2,
      aokiPctTip: 100,
      aokiPctShaft: 100,
      decourtAlphaPct: null,
      decourtBetaPct: null,
      teixeiraFs: 2,
      teixeiraPctTip: 100,
      teixeiraPctShaft: 100,
      blockRows: 1,
      blockCols: 1,
      blockEdge_m: 0.25,
      result: null,
      structural,
      blockResult: null,
      footingResult: null,
      caissonResult: null,
      raftResult: null,
      footingShape: "square",
      footingAdmMode: "user",
      foundationKind: "pile",
      fck_MPa: 25,
      cover_mm: 50,
    });

    const doc = buildMemorialDocument(memInput);
    const fontBytes = new Uint8Array(
      readFileSync(join(process.cwd(), "memorial-engine/fonts/Roboto-Regular.ttf")),
    );
    const pdfBytes = await memorialToPdf(doc, { fontBytes });
    expect(pdfBytes.byteLength).toBeGreaterThan(5000);
    const head = String.fromCharCode(...pdfBytes.slice(0, 5));
    expect(head).toBe("%PDF-");
  });
});
