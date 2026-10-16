import { describe, expect, it } from "vitest";
import { calculate } from "@engine/index";
import { designPileReinforcement } from "@structural/index";
import { refInput, refExpected } from "../fixtures/reference";
import {
  buildMemorialDocument,
  memorialToMarkdown,
  memorialToHtml,
  type MemorialInput,
} from "../../memorial-engine/index";

describe("memorial-engine", () => {
  const geo = calculate({
    ...(refInput as Parameters<typeof calculate>[0]),
    mode: "engineering",
    governingRule: "minimum",
    designLoad_kN: 200,
  });

  const input: MemorialInput = {
    generatedAtIso: "2026-09-09T12:00:00.000Z",
    softwareVersion: "0.1.0",
    project: {
      name: "Exemplo",
      code: "EX-01",
      client: "Validação",
      location: "Demo",
    },
    pile: {
      typeLabel: "Escavada",
      diameter_cm: 30,
      tipDepth_m: 4,
    },
    site: { waterLevel_m: 42 },
    layers: [
      { depth_m: 1, nspt: 14, soilLabel: "Argila arenosa" },
      { depth_m: 2, nspt: 21, soilLabel: "Argila arenosa" },
      { depth_m: 3, nspt: 37, soilLabel: "Argila arenosa" },
      { depth_m: 4, nspt: 21, soilLabel: "Silte arenoso" },
    ],
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

  it("monta seções sem recalcular Padm", () => {
    const doc = buildMemorialDocument(input);
    expect(doc.sections.length).toBeGreaterThanOrEqual(15);
    expect(doc.sections[0]!.id).toBe("identificacao");
    expect(doc.sections[0]!.paragraphs.join(" ")).toMatch(/MODO DE CÁLCULO/i);
    expect(doc.sections[0]!.paragraphs.join(" ")).toMatch(/fórmulas publicadas/i);
    expect(doc.sections[0]!.paragraphs.join(" ")).toMatch(/AGPL-3\.0/);
    expect(memorialToMarkdown(doc)).not.toMatch(/excel|planilha|compatibilidade/i);
    const escopo = doc.sections.find((s) => s.id === "escopo")!;
    expect(escopo.paragraphs.join(" ")).toMatch(/projeto vs MVP/i);
    expect(escopo.paragraphs.join(" ")).toMatch(/compressão centrada/i);
    expect(doc.sections.some((s) => s.id === "notas")).toBe(true);
    const resultado = doc.sections.find((s) => s.id === "resultado")!;
    expect(resultado.paragraphs.join(" ")).toContain(
      geo.atTip.governingPadm_kN.toFixed(2),
    );
  });

  it("markdown e html contêm tabela de comparação", () => {
    const doc = buildMemorialDocument(input);
    const md = memorialToMarkdown(doc);
    const html = memorialToHtml(doc);
    expect(md).toContain("Aoki-Velloso");
    expect(md).toContain("| Método |");
    expect(html).toContain("<table>");
    expect(html).toContain("ATENDE");
  });

  it("sem geotécnico ainda gera memorial parcial", () => {
    const doc = buildMemorialDocument({ ...input, geotechnical: null });
    const calc = doc.sections.find((s) => s.id === "calculos")!;
    expect(calc.paragraphs[0]).toMatch(/não disponível/i);
  });

  it("armadura centrada declara escopo (DEC-31/51)", () => {
    const structural = designPileReinforcement({
      pileTypeId: 6,
      diameter_m: 0.3,
      tipDepth_m: 4,
      Nk_kN: 100,
      loadIsDesign: false,
    });
    const doc = buildMemorialDocument({ ...input, structural });
    const arm = doc.sections.find((s) => s.id === "armadura")!;
    expect(arm.title).toMatch(/compressão centrada|sem N-M/i);
    expect(arm.paragraphs.join(" ")).toMatch(/compressão centrada/i);
    expect(structural.nm?.mode).toBe("centered");
  });

  it("armadura com M declara flexo-compressão no memorial", () => {
    const structural = designPileReinforcement({
      pileTypeId: 6,
      diameter_m: 0.3,
      tipDepth_m: 4,
      Nk_kN: 150,
      Mk_kNm: 20,
      loadIsDesign: true,
    });
    const doc = buildMemorialDocument({ ...input, structural });
    const arm = doc.sections.find((s) => s.id === "armadura")!;
    expect(structural.nm?.mode).toBe("nm");
    expect(arm.title).toMatch(/flexo-compressão/i);
    expect(arm.paragraphs.join(" ")).toMatch(/Msd/i);
  });

  it("memorial de sapata serializa footing-engine", () => {
    const doc = buildMemorialDocument({
      ...input,
      geotechnical: null,
      footing: {
        shape: "square",
        admMode: "user",
        Nd_kN: 1000,
        B_m: 2.24,
        L_m: 2.24,
        area_m2: 5,
        thickness_m: 0.5,
        qadm_kPa: 200,
        qult_kPa: null,
        sigmaAvg_kPa: 200,
        sigmaMax_kPa: 200,
        checksOk: true,
        warnings: [],
      },
    });
    expect(doc.title).toMatch(/Sapata/i);
    expect(doc.sections.some((s) => s.id === "sapata")).toBe(true);
    expect(memorialToMarkdown(doc)).toContain("2.24");
    expect(memorialToMarkdown(doc)).toMatch(/ESCOPO: sem cálculo de recalque/i);
  });

  it("memorial de tubulão e radier", () => {
    const tub = buildMemorialDocument({
      generatedAtIso: input.generatedAtIso,
      softwareVersion: input.softwareVersion,
      project: input.project,
      pile: null,
      methods: null,
      site: { waterLevel_m: null },
      layers: [],
      designLoad_kN: 2000,
      geotechnical: null,
      structural: null,
      caisson: {
        Nd_kN: 2000,
        shaftDiameter_m: 1.2,
        baseDiameter_m: 1.5,
        length_m: 8,
        Rp_adm_kN: 1500,
        Rl_adm_kN: 400,
        Padm_kN: 1900,
        verdict: "not_ok",
        warnings: [],
        rebarMessage: "As,mín teste",
      },
    });
    expect(tub.title).toMatch(/Tubulão/i);
    expect(memorialToMarkdown(tub)).toContain("As,mín teste");
    const rad = buildMemorialDocument({
      generatedAtIso: input.generatedAtIso,
      softwareVersion: input.softwareVersion,
      project: input.project,
      pile: null,
      methods: null,
      site: { waterLevel_m: null },
      layers: [],
      designLoad_kN: 5000,
      geotechnical: null,
      structural: null,
      raft: {
        Nd_kN: 5000,
        B_m: 4,
        L_m: 8,
        area_m2: 32,
        thickness_m: 0.5,
        qadm_kPa: 150,
        sigmaAvg_kPa: 156,
        sigmaMax_kPa: 160,
        checksOk: false,
        warnings: ["aviso"],
      },
    });
    expect(rad.title).toMatch(/Radier/i);
  });

  it("gera seções de dados gerais, cargas e medição/takeoff", () => {
    const structural = designPileReinforcement({
      pileTypeId: 6,
      diameter_m: 0.3,
      tipDepth_m: 4,
      Nk_kN: 200,
      loadIsDesign: false,
    });

    const doc = buildMemorialDocument({
      ...input,
      structural,
      generalData: {
        concretePiles: "C25",
        concreteCaps: "C30",
        steelGrade: "CA-50 / CA-60",
        coverTop_cm: 5.0,
        coverBottom_cm: 5.0,
        coverLateral_cm: 8.0,
        leanConcreteThickness_cm: 10.0,
        maxAggregateSize_mm: 30,
        standards: ["NBR 6118:2023", "NBR 6122:2019"],
      },
      loadsTable: [
        {
          element: "P01",
          combination: "Característica (Rara)",
          N_kN: 200,
          Mx_kNm: 15,
          My_kNm: 10,
          Vx_kN: 8,
          Vy_kN: 6,
          Mt_kNm: 0,
        },
      ],
      elementTakeoffs: structural.takeoff ? [structural.takeoff] : undefined,
    });

    // Seção 1B: Dados gerais
    const secDados = doc.sections.find((s) => s.id === "dados_gerais");
    expect(secDados).toBeDefined();
    expect(secDados?.title).toContain("Dados gerais de projeto e normas");
    expect(secDados?.table).toBeDefined();

    // Seção 4B: Cargas
    const secCargas = doc.sections.find((s) => s.id === "descricao_cargas");
    expect(secCargas).toBeDefined();
    expect(secCargas?.table).toBeDefined();
    expect(secCargas?.table?.rows[0]?.[0]).toBe("P01");

    // Seção 12A: Medição
    const secMedicao = doc.sections.find((s) => s.id === "medicao");
    expect(secMedicao).toBeDefined();
    expect(secMedicao?.tables?.length).toBeGreaterThanOrEqual(1);

    // Markdown e HTML
    const md = memorialToMarkdown(doc);
    expect(md).toContain("Dados gerais de projeto e normas");
    expect(md).toContain("Descrição de cargas");
    expect(md).toContain("Medição e quantitativos");
    expect(md).toContain("CA-50");

    const html = memorialToHtml(doc);
    expect(html).toContain("dados_gerais");
    expect(html).toContain("descricao_cargas");
    expect(html).toContain("medicao");
  });
});
