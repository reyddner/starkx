import { describe, expect, it } from "vitest";
import {
  buildProjectDrawingBook,
  drawPileCapSheet,
  drawPileSheet,
  drawFootingSheet,
  exportProjectBookToPdf,
  exportSheetToSvg,
  extractRebarShapes,
  selectBestScale,
  createLinearDimension,
} from "../../drawing-engine";
import type { BlockDesignResult } from "../../block-engine/types";
import type { FootingDesignResult } from "../../footing-engine/types";
import type { ElementTakeoff } from "../../structural-engine/takeoff/types";

describe("Drawing Engine — A4 Technical Sheets & Rebar Detailing", () => {
  it("selectBestScale escolhe a escala ABNT ideal para encaixar na folha", () => {
    // Bloco 1.40 x 1.40m em área de 90x90mm
    const scale = selectBestScale(
      { width_m: 1.4, length_m: 1.4 },
      { width: 90, height: 90, x: 0, y: 0 },
    );
    expect([20, 25]).toContain(scale.scaleFactor);

    // Sapata grande de 5.0 x 5.0m
    const bigScale = selectBestScale(
      { width_m: 5.0, length_m: 5.0 },
      { width: 90, height: 90, x: 0, y: 0 },
    );
    expect(bigScale.scaleFactor).toBeGreaterThanOrEqual(75);
  });

  it("extractRebarShapes desdobra armaduras em esquemas cotados", () => {
    const mockTakeoff: ElementTakeoff = {
      elementRef: "Bloco B-1",
      elementKind: "pile_cap",
      concreteGrade: "C30",
      concreteVolume_m3: 1.5,
      leanConcreteVolume_m3: 0.15,
      items: [
        {
          name: "Armadura base - Malha inferior X",
          steelGrade: "CA-50",
          diameter_mm: 12.5,
          count: 10,
          unitLength_m: 1.8,
          totalLength_m: 18.0,
          weightKgPerMeter: 0.963,
          totalWeight_kg: 17.33,
        },
        {
          name: "Armadura estribos XY (horizontal)",
          steelGrade: "CA-50",
          diameter_mm: 8.0,
          count: 4,
          unitLength_m: 4.8,
          totalLength_m: 19.2,
          weightKgPerMeter: 0.395,
          totalWeight_kg: 7.58,
        },
      ],
      totalSteelWeight_kg: 24.91,
      totalSteelWithLosses_kg: 27.4,
      lossPercentage: 10,
      byDiameter: {},
    };

    const shapes = extractRebarShapes(mockTakeoff, {
      width_m: 1.2,
      length_m: 1.2,
      height_m: 0.7,
      cover_m: 0.05,
    });

    expect(shapes.length).toBe(2);
    expect(shapes[0]?.kind).toBe("u_shape");
    expect(shapes[0]?.legs_cm.length).toBe(3); // [gancho, trecho reto, gancho]
    expect(shapes[1]?.kind).toBe("closed_rect");
    expect(shapes[1]?.legs_cm.length).toBe(2); // [largura, comprimento]
  });

  it("extractRebarShapes reconhece armadura de estaca (vertical + espiral)", () => {
    const pileTakeoff: ElementTakeoff = {
      elementRef: "Estaca E1",
      elementKind: "pile",
      concreteGrade: "C30",
      concreteVolume_m3: 0.35,
      leanConcreteVolume_m3: 0,
      items: [
        {
          name: "Armadura vertical",
          steelGrade: "CA-50",
          diameter_mm: 16,
          count: 8,
          unitLength_m: 8.5,
          totalLength_m: 68,
          weightKgPerMeter: 1.578,
          totalWeight_kg: 107.3,
        },
        {
          name: "Armadura espiral",
          steelGrade: "CA-60",
          diameter_mm: 6.3,
          count: 1,
          unitLength_m: 42,
          totalLength_m: 42,
          weightKgPerMeter: 0.245,
          totalWeight_kg: 10.3,
        },
      ],
      totalSteelWeight_kg: 117.6,
      totalSteelWithLosses_kg: 129.4,
      lossPercentage: 10,
      byDiameter: {},
    };
    const shapes = extractRebarShapes(pileTakeoff, {
      width_m: 0.4,
      length_m: 0.4,
      height_m: 8,
      cover_m: 0.05,
    });
    expect(shapes[0]?.kind).toBe("straight");
    expect(shapes[1]?.kind).toBe("circular_ring");
  });

  it("drawPileSheet gera prancha de estaca com desdobramento e relação de aço", () => {
    const pileTakeoff: ElementTakeoff = {
      elementRef: "Estaca típica (×4)",
      elementKind: "pile",
      concreteGrade: "C30",
      concreteVolume_m3: 0.4,
      leanConcreteVolume_m3: 0,
      items: [
        {
          name: "Armadura vertical",
          steelGrade: "CA-50",
          diameter_mm: 12.5,
          count: 6,
          unitLength_m: 7.2,
          totalLength_m: 43.2,
          weightKgPerMeter: 0.963,
          totalWeight_kg: 41.6,
        },
        {
          name: "Armadura espiral",
          steelGrade: "CA-60",
          diameter_mm: 6.3,
          count: 1,
          unitLength_m: 28,
          totalLength_m: 28,
          weightKgPerMeter: 0.245,
          totalWeight_kg: 6.9,
        },
      ],
      totalSteelWeight_kg: 48.5,
      totalSteelWithLosses_kg: 53.4,
      lossPercentage: 10,
      byDiameter: {},
    };

    const sheet = drawPileSheet({
      diameter_m: 0.35,
      length_m: 8,
      pileCount: 4,
      longitudinalCount: 6,
      cageLength_m: 4,
      takeoff: pileTakeoff,
      titleInfo: {
        projectName: "Obra Teste",
        elementRef: "Estaca típica (×4)",
        drawingTitle: "DETALHAMENTO — ESTACA",
        scaleLabel: "1:25",
        sheetNumber: 3,
        totalSheets: 3,
        date: "13/09/2026",
      },
    });

    expect(sheet.width_mm).toBe(297);
    const texts = sheet.primitives.filter((p) => p.type === "text").map((t) => (t.type === "text" ? t.text : ""));
    expect(texts.some((t) => t.includes("SEÇÃO"))).toBe(true);
    expect(texts.some((t) => t.includes("CORTE"))).toBe(true);
    expect(texts.some((t) => t.includes("DESDOBRAMENTO"))).toBe(true);
    expect(texts.some((t) => t.includes("RELAÇÃO DO AÇO"))).toBe(true);
  });

  it("drawPileCapSheet gera folha A4 com planta, corte, desdobramento e carimbo", () => {
    const mockBlock: BlockDesignResult = {
      pileCount: 2,
      spacing_m: 1.2,
      spacingMin_m: 0.9,
      piles: [
        { id: "p1", label: "E1", position: { x_m: -0.6, y_m: 0 } },
        { id: "p2", label: "E2", position: { x_m: 0.6, y_m: 0 } },
      ],
      cap: {
        minX_m: -1.0,
        maxX_m: 1.0,
        minY_m: -0.5,
        maxY_m: 0.5,
        width_m: 2.0,
        length_m: 1.0,
        thickness_m: 0.8,
        area_m2: 2.0,
      },
      checks: [],
      groupPadm_kN: 700,
      efficiency: 1.0,
      efficiencyUserProvided: false,
      groupCapacityIndicative: false,
      capacityOk: true,
      traces: [],
      warnings: [],
      strutTie: null,
      punching: null,
      rebar: null,
      pileLoads_kN: [],
    };

    const sheet = drawPileCapSheet({
      blockResult: mockBlock,
      pileDiameter_m: 0.4,
      titleInfo: {
        projectName: "Edifício Horizonte",
        client: "Construtora Silva",
        elementRef: "BLOCO B-1",
        drawingTitle: "DETALHAMENTO E CORTE/DOBRA",
        scaleLabel: "1:25",
        sheetNumber: 2,
        totalSheets: 2,
        date: "12/09/2026",
      },
    });

    expect(sheet.width_mm).toBe(297);
    expect(sheet.height_mm).toBe(210);
    expect(sheet.primitives.length).toBeGreaterThan(20);

    // Deve conter elementos de corte e planta
    const textPrimitives = sheet.primitives.filter((p) => p.type === "text");
    expect(textPrimitives.some((t) => t.type === "text" && t.text.includes("PLANTA"))).toBe(true);
    expect(textPrimitives.some((t) => t.type === "text" && t.text.includes("CORTE"))).toBe(true);
    expect(textPrimitives.some((t) => t.type === "text" && t.text.includes("DESDOBRAMENTO"))).toBe(true);
  });

  it("drawFootingSheet gera prancha técnica completa de sapata isolada", () => {
    const mockFooting: FootingDesignResult = {
      Nk_kN: 321.43,
      rigid: true,
      Nd_kN: 450,
      B_m: 1.5,
      L_m: 1.5,
      area_m2: 2.25,
      thickness_m: 0.5,
      thicknessSuggested_m: 0.5,
      qult_kPa: 600,
      qadm_kPa: 250,
      sigmaAvg_kPa: 200,
      sigmaMax_kPa: 200,
      ex_m: 0,
      ey_m: 0,
      factors: null,
      checks: [],
      traces: [],
      warnings: [],
      rebar: {
        As_min_cm2_per_m: 3.5,
        AsB_cm2_per_m: 3.5,
        AsL_cm2_per_m: 3.5,
        suggestBar_mm: 10.0,
        suggestSpacing_cm: 15,
        message: "OK",
      },
    };

    const sheet = drawFootingSheet({
      footingResult: mockFooting,
      titleInfo: {
        projectName: "Edifício Sol",
        elementRef: "SAPATA S-1",
        drawingTitle: "DETALHAMENTO E CORTE/DOBRA",
        scaleLabel: "1:25",
        sheetNumber: 2,
        totalSheets: 2,
        date: "12/09/2026",
      },
    });

    expect(sheet.width_mm).toBe(297);
    expect(sheet.height_mm).toBe(210);
    const texts = sheet.primitives.filter((p) => p.type === "text").map((t: any) => t.text);
    expect(texts.some((t) => t.includes("PLANTA BAIXA"))).toBe(true);
    expect(texts.some((t) => t.includes("CORTE VERTICAL"))).toBe(true);
    expect(texts.some((t) => t.includes("DESDOBRAMENTO"))).toBe(true);
  });

  it("suporta incorporação de logotipo da empresa (white-label) no carimbo", async () => {
    // PNG 1x1 transparente válido em Base64
    const samplePngBase64 =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const mockBlock: BlockDesignResult = {
      pileCount: 1,
      spacing_m: 0,
      spacingMin_m: 0,
      piles: [{ id: "p1", label: "E1", position: { x_m: 0, y_m: 0 } }],
      cap: {
        minX_m: -0.4,
        maxX_m: 0.4,
        minY_m: -0.4,
        maxY_m: 0.4,
        width_m: 0.8,
        length_m: 0.8,
        thickness_m: 0.6,
        area_m2: 0.64,
      },
      checks: [],
      groupPadm_kN: 350,
      efficiency: 1.0,
      efficiencyUserProvided: false,
      groupCapacityIndicative: false,
      capacityOk: true,
      traces: [],
      warnings: [],
      strutTie: null,
      punching: null,
      rebar: null,
      pileLoads_kN: [],
    };

    const book = buildProjectDrawingBook({
      projectName: "Edifício Master",
      companyLogoBase64: samplePngBase64,
      engineerName: "Eng. Construtor",
      blocks: [{ result: mockBlock, pileDiameter_m: 0.4, ref: "B-1" }],
    });

    // Prancha 1 e 2 devem conter a imagem do logotipo
    const imagesSheet1 = book.sheets[0]!.primitives.filter((p) => p.type === "image");
    expect(imagesSheet1.length).toBeGreaterThan(0);

    // Exportação em SVG contém a tag <image>
    const svg = exportSheetToSvg(book.sheets[0]!);
    expect(svg).toContain("<image");

    // Exportação em PDF incorpora a imagem sem erros
    const pdfBytes = await exportProjectBookToPdf(book);
    expect(pdfBytes.length).toBeGreaterThan(1000);
  });

  it("buildProjectDrawingBook monta caderno completo e exporta SVG e PDF válidos", async () => {
    const mockBlock: BlockDesignResult = {
      pileCount: 1,
      spacing_m: 0,
      spacingMin_m: 0,
      piles: [{ id: "p1", label: "E1", position: { x_m: 0, y_m: 0 } }],
      cap: {
        minX_m: -0.4,
        maxX_m: 0.4,
        minY_m: -0.4,
        maxY_m: 0.4,
        width_m: 0.8,
        length_m: 0.8,
        thickness_m: 0.6,
        area_m2: 0.64,
      },
      checks: [],
      groupPadm_kN: 350,
      efficiency: 1.0,
      efficiencyUserProvided: false,
      groupCapacityIndicative: false,
      capacityOk: true,
      traces: [],
      warnings: [],
      strutTie: null,
      punching: null,
      rebar: null,
      pileLoads_kN: [],
    };

    const pileTakeoff: ElementTakeoff = {
      elementRef: "Estaca típica (×4)",
      elementKind: "pile",
      concreteGrade: "C30",
      concreteVolume_m3: 0.4,
      leanConcreteVolume_m3: 0,
      items: [
        {
          name: "Armadura vertical",
          steelGrade: "CA-50",
          diameter_mm: 12.5,
          count: 6,
          unitLength_m: 7.2,
          totalLength_m: 43.2,
          weightKgPerMeter: 0.963,
          totalWeight_kg: 41.6,
        },
      ],
      totalSteelWeight_kg: 41.6,
      totalSteelWithLosses_kg: 45.8,
      lossPercentage: 10,
      byDiameter: {},
    };

    const book = buildProjectDrawingBook({
      projectName: "Residencial Jardins",
      client: "Dr. Roberto",
      location: "São Paulo - SP",
      engineerName: "Eng. Lucas Stark",
      crea: "CREA-SP 506070",
      blocks: [
        {
          result: mockBlock,
          pileDiameter_m: 0.35,
          pileShaftLength_m: 0.9,
          ref: "B-1",
        },
      ],
      piles: [
        {
          diameter_m: 0.35,
          length_m: 8,
          pileCount: 4,
          ref: "Estaca típica (×4)",
          takeoff: pileTakeoff,
          longitudinalCount: 6,
          cageLength_m: 4,
          transverseKind: "spiral",
        },
      ],
      takeoffSummary: {
        elements: [],
        lossPercentage: 10,
        ca50ByDiameter_kg: { 10: 55.4 },
        ca60ByDiameter_kg: { 5: 12.3 },
        totalCA50_kg: 55.4,
        totalCA60_kg: 12.3,
        totalSteel_kg: 67.7,
        concreteByGrade_m3: { C30: 0.38 },
        totalLeanConcrete_m3: 0.06,
      },
    });

    expect(book.totalSheets).toBe(3);
    expect(book.sheets.length).toBe(3);
    expect(book.sheets[0]?.title).toBe("Folha de Rosto e Quadro Geral");
    expect(book.sheets[1]?.title).toContain("B-1");
    expect(book.sheets[2]?.title.toLowerCase()).toContain("estaca");
    const generalSvg = exportSheetToSvg(book.sheets[0]!);
    expect(generalSvg).toMatch(/Estaca/i);

    // 1. Exportação SVG
    const svgSheet1 = exportSheetToSvg(book.sheets[0]!);
    expect(svgSheet1).toContain("<svg");
    expect(svgSheet1).toContain("QUADRO GERAL");
    expect(svgSheet1).toContain("</svg>");

    // 2. Exportação PDF
    const pdfBytes = await exportProjectBookToPdf(book);
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);

    // Confere cabeçalho mágico do arquivo PDF: %PDF-1.
    const headerStr = String.fromCharCode(...pdfBytes.slice(0, 5));
    expect(headerStr).toBe("%PDF-");
  });

  describe("integridade de layout A4", () => {
    const mockBlockOf = (
      width_m: number,
      length_m: number,
      pileXs: number[],
    ): BlockDesignResult => ({
      pileCount: pileXs.length,
      spacing_m: 0,
      spacingMin_m: 0,
      piles: pileXs.map((x, i) => ({
        id: `p${i}`,
        label: `E${i + 1}`,
        position: { x_m: x, y_m: 0 },
      })),
      cap: {
        minX_m: -width_m / 2,
        maxX_m: width_m / 2,
        minY_m: -length_m / 2,
        maxY_m: length_m / 2,
        width_m,
        length_m,
        thickness_m: 0.7,
        area_m2: width_m * length_m,
      },
      checks: [],
      groupPadm_kN: 900,
      efficiency: 1,
      efficiencyUserProvided: false,
      groupCapacityIndicative: false,
      capacityOk: true,
      traces: [],
      warnings: [],
      strutTie: null,
      punching: null,
      rebar: null,
      pileLoads_kN: [],
    });

    const manyItemsTakeoff = (count: number): ElementTakeoff => ({
      elementRef: "Bloco denso",
      elementKind: "pile_cap",
      concreteGrade: "C30",
      concreteVolume_m3: 3,
      leanConcreteVolume_m3: 0.3,
      items: Array.from({ length: count }, (_, i) => ({
        name: i % 2 === 0 ? "Malha X inferior" : "Estribo perimetral",
        steelGrade: "CA-50" as const,
        diameter_mm: 10,
        count: 8,
        unitLength_m: 2.4,
        totalLength_m: 19.2,
        weightKgPerMeter: 0.617,
        totalWeight_kg: 11.8,
      })),
      totalSteelWeight_kg: 11.8 * count,
      totalSteelWithLosses_kg: 13 * count,
      lossPercentage: 10,
      byDiameter: {},
    });

    /** Extremos ocupados pelas primitivas geométricas da folha. */
    function sheetBounds(sheet: { primitives: unknown[] }) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const raw of sheet.primitives) {
        const p = raw as Record<string, number | string>;
        const track = (x: number, y: number) => {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        };
        if (p.type === "line") {
          track(p.x1 as number, p.y1 as number);
          track(p.x2 as number, p.y2 as number);
        } else if (p.type === "rect" || p.type === "image") {
          track(p.x as number, p.y as number);
          track((p.x as number) + (p.width as number), (p.y as number) + (p.height as number));
        } else if (p.type === "circle") {
          track((p.cx as number) - (p.r as number), (p.cy as number) - (p.r as number));
          track((p.cx as number) + (p.r as number), (p.cy as number) + (p.r as number));
        }
      }
      return { minX, minY, maxX, maxY };
    }

    it("bloco grande permanece dentro da folha (clamp de escala)", () => {
      const sheet = drawPileCapSheet({
        blockResult: mockBlockOf(6.2, 6.2, [-2.1, 0, 2.1]),
        pileDiameter_m: 0.6,
        titleInfo: {
          projectName: "Obra Grande",
          elementRef: "B-9",
          drawingTitle: "DETALHAMENTO — BLOCO",
          scaleLabel: "1:50",
          sheetNumber: 2,
          totalSheets: 2,
          date: "13/09/2026",
        },
      });
      const b = sheetBounds(sheet);
      expect(b.minX).toBeGreaterThanOrEqual(0);
      expect(b.minY).toBeGreaterThanOrEqual(0);
      expect(b.maxX).toBeLessThanOrEqual(297);
      expect(b.maxY).toBeLessThanOrEqual(210);
    });

    it("tabela com muitas posições não invade o carimbo", () => {
      const sheet = drawPileCapSheet({
        blockResult: mockBlockOf(1.6, 1.6, [-0.5, 0.5]),
        pileDiameter_m: 0.4,
        takeoff: manyItemsTakeoff(40),
        titleInfo: {
          projectName: "Obra Densa",
          elementRef: "B-10",
          drawingTitle: "DETALHAMENTO — BLOCO",
          scaleLabel: "1:25",
          sheetNumber: 2,
          totalSheets: 2,
          date: "13/09/2026",
        },
      });
      // Retângulos da coluna direita (x ≥ 187) não devem passar de y = 155 (topo do carimbo).
      const tableRects = sheet.primitives.filter(
        (p): p is Extract<typeof p, { type: "rect" }> =>
          p.type === "rect" && p.x >= 186 && p.y < 155,
      );
      for (const r of tableRects) {
        expect(r.y + r.height).toBeLessThanOrEqual(155.01);
      }
      const b = sheetBounds(sheet);
      expect(b.maxY).toBeLessThanOrEqual(210);
      expect(b.maxX).toBeLessThanOrEqual(297);
    });

    it("SVG usa fonte em unidades do viewBox (texto na escala do desenho)", () => {
      const sheet = drawPileCapSheet({
        blockResult: mockBlockOf(1.8, 1.8, [-0.6, 0.6]),
        pileDiameter_m: 0.4,
        titleInfo: {
          projectName: "Obra",
          elementRef: "B-2",
          drawingTitle: "DETALHAMENTO — BLOCO",
          scaleLabel: "1:25",
          sheetNumber: 2,
          totalSheets: 2,
          date: "13/09/2026",
        },
      });
      const svg = exportSheetToSvg(sheet);
      // Unidades absolutas (mm/pt/px) não acompanham o viewBox e inflavam o texto ~3,8×.
      expect(svg).not.toMatch(/font-size="[\d.]+(mm|pt|px|cm|in)"/);
      const sizes = [...svg.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
      expect(sizes.length).toBeGreaterThan(0);
      // fontSize das primitivas é mm de folha (títulos ~6–8, anotações ~4–5).
      for (const size of sizes) {
        expect(size).toBeGreaterThanOrEqual(3);
        expect(size).toBeLessThanOrEqual(12);
      }
    });

    const pileTakeoffOf = (cageL: number): ElementTakeoff => ({
      elementRef: "Estaca típica",
      elementKind: "pile",
      concreteGrade: "C30",
      concreteVolume_m3: 0.55,
      leanConcreteVolume_m3: 0,
      items: [
        {
          name: "Armadura vertical",
          steelGrade: "CA-50",
          diameter_mm: 12.5,
          count: 6,
          unitLength_m: cageL,
          totalLength_m: cageL * 6,
          weightKgPerMeter: 0.963,
          totalWeight_kg: cageL * 6 * 0.963,
        },
        {
          name: "Armadura espiral",
          steelGrade: "CA-60",
          diameter_mm: 6.3,
          count: 1,
          unitLength_m: 30,
          totalLength_m: 30,
          weightKgPerMeter: 0.245,
          totalWeight_kg: 7.4,
        },
      ],
      totalSteelWeight_kg: 50,
      totalSteelWithLosses_kg: 55,
      lossPercentage: 10,
      byDiameter: {},
    });

    const pileSheetOf = (diameter_m: number, length_m: number, cageLength_m: number) =>
      drawPileSheet({
        diameter_m,
        length_m,
        cageLength_m,
        pileCount: 4,
        longitudinalCount: 6,
        takeoff: pileTakeoffOf(cageLength_m),
        titleInfo: {
          projectName: "Obra Estaca",
          elementRef: "E-1",
          drawingTitle: "DETALHAMENTO — ESTACA",
          scaleLabel: "1:25",
          sheetNumber: 2,
          totalSheets: 2,
          date: "13/09/2026",
        },
      });

    it("estaca esbelta mantém o corte dentro da folha e acima do carimbo", () => {
      const sheet = pileSheetOf(0.3, 12, 6);
      const b = sheetBounds(sheet);
      expect(b.minX).toBeGreaterThanOrEqual(0);
      expect(b.minY).toBeGreaterThanOrEqual(0);
      expect(b.maxX).toBeLessThanOrEqual(297);
      expect(b.maxY).toBeLessThanOrEqual(210);

      // Coluna esquerda (corte/seção) não invade a faixa do carimbo (y > 200).
      const leftColumn = sheet.primitives.filter(
        (p) => p.type === "rect" && p.x < 100,
      );
      for (const r of leftColumn) {
        if (r.type !== "rect") continue;
        expect(r.y + r.height).toBeLessThanOrEqual(200.01);
        expect(r.height).toBeGreaterThanOrEqual(0);
      }
    });

    it("fuste do corte é legível (largura mínima) mesmo em estaca longa", () => {
      const sheet = pileSheetOf(0.25, 14, 7);
      // O maior retângulo do corte (coluna esquerda, abaixo da seção) precisa ter
      // largura desenhável — antes o fuste virava um fio de <1 mm.
      const shaftRects = sheet.primitives.filter(
        (p): p is Extract<typeof p, { type: "rect" }> =>
          p.type === "rect" && p.x < 100 && p.y > 88 && p.height > 5,
      );
      expect(shaftRects.length).toBeGreaterThan(0);
      expect(Math.max(...shaftRects.map((r) => r.width))).toBeGreaterThanOrEqual(6);
    });

    it("corte com quebra anota a escala e o trecho omitido", () => {
      const sheet = pileSheetOf(0.3, 12, 6);
      const texts = sheet.primitives
        .filter((p) => p.type === "text")
        .map((t) => (t.type === "text" ? t.text : ""));
      expect(texts.some((t) => /CORTE/.test(t) && (/quebra|\*/.test(t) || texts.some((u) => u.includes("quebra"))))).toBe(true);
      expect(texts.some((t) => t.includes("trecho omitido") || t.includes("c/ quebra"))).toBe(true);
      // A cota mostra o comprimento real (1200 cm), não o trecho desenhado.
      expect(texts.some((t) => t === "1200")).toBe(true);
    });

    it("estaca curta é desenhada inteira, sem quebra", () => {
      const sheet = pileSheetOf(0.5, 3, 3);
      const texts = sheet.primitives
        .filter((p) => p.type === "text")
        .map((t) => (t.type === "text" ? t.text : ""));
      expect(texts.some((t) => t.startsWith("CORTE (") && !t.includes("*"))).toBe(true);
      expect(texts.some((t) => t.includes("trecho omitido") || t.includes("c/ quebra"))).toBe(false);
      expect(texts.some((t) => t === "300")).toBe(true);
    });

    it("prancha de estaca existe sem takeoff (geometria ainda sai no caderno)", () => {
      const sheet = drawPileSheet({
        diameter_m: 0.35,
        length_m: 8,
        pileCount: 2,
        titleInfo: {
          projectName: "Obra",
          elementRef: "Estaca típica (×2)",
          drawingTitle: "DETALHAMENTO E CORTE/DOBRA — ESTACA",
          scaleLabel: "1:25",
          sheetNumber: 2,
          totalSheets: 2,
          date: "14/09/2026",
        },
      });
      const texts = sheet.primitives
        .filter((p) => p.type === "text")
        .map((t) => (t.type === "text" ? t.text : ""));
      expect(texts.some((t) => t.includes("SEÇÃO"))).toBe(true);
      expect(texts.some((t) => t.includes("CORTE"))).toBe(true);
      const circles = sheet.primitives.filter((p) => p.type === "circle");
      expect(circles.length).toBeGreaterThan(0);
    });

    it("corte do bloco desenha o topo acima da base (Y do modelo para cima)", () => {
      const sheet = drawPileCapSheet({
        blockResult: mockBlockOf(2.2, 2.2, [-0.7, 0.7]),
        pileDiameter_m: 0.4,
        titleInfo: {
          projectName: "Obra",
          elementRef: "B-1",
          drawingTitle: "DETALHAMENTO — BLOCO",
          scaleLabel: "1:25",
          sheetNumber: 2,
          totalSheets: 2,
          date: "13/09/2026",
        },
      });
      // No corte (y ≥ 108): o concreto magro fica abaixo do bloco e o arranque acima.
      const secRects = sheet.primitives.filter(
        (p): p is Extract<typeof p, { type: "rect" }> =>
          p.type === "rect" && p.y >= 108 && p.x < 120 && p.height > 0.5,
      );
      expect(secRects.length).toBeGreaterThanOrEqual(3);
      const lean = sheet.primitives.find(
        (p) => p.type === "text" && (p.text.includes("MAGRO") || p.text.includes("CONCRETO MAGRO")),
      );
      const blockRect = secRects.reduce((a, b) => (a.height * a.width > b.height * b.width ? a : b));
      // Magro fica na faixa inferior do corte (Y folha maior = mais abaixo)
      expect(lean?.type === "text" && lean.y > blockRect.y).toBe(true);
    });

    it("planta e corte projetam retângulos com altura positiva dentro das caixas", () => {
      const sheet = drawPileCapSheet({
        blockResult: mockBlockOf(2.2, 2.2, [-0.7, 0.7]),
        pileDiameter_m: 0.4,
        titleInfo: {
          projectName: "Obra",
          elementRef: "B-1",
          drawingTitle: "DETALHAMENTO — BLOCO",
          scaleLabel: "1:25",
          sheetNumber: 2,
          totalSheets: 2,
          date: "13/09/2026",
        },
      });
      const rects = sheet.primitives.filter((p) => p.type === "rect");
      for (const r of rects) {
        if (r.type !== "rect") continue;
        expect(r.width).toBeGreaterThanOrEqual(0);
        expect(r.height).toBeGreaterThanOrEqual(0);
      }
      // A planta ocupa a metade superior esquerda; o corte, a inferior esquerda.
      const b = sheetBounds(sheet);
      expect(b.minX).toBeGreaterThanOrEqual(0);
      expect(b.maxY).toBeLessThanOrEqual(210);
    });

    it("cotas verticais respeitam o lado do offset (não entram no desenho)", () => {
      // À esquerda do contorno x=50: texto e linha de cota com x < 50
      const leftDim = createLinearDimension({
        start: { x: 50, y: 20 },
        end: { x: 50, y: 80 },
        offset_mm: -8,
        measurement_cm: 60,
        orientation: "vertical",
      });
      const leftTexts = leftDim.filter((p) => p.type === "text");
      expect(leftTexts.length).toBe(1);
      expect(leftTexts[0]!.type === "text" && leftTexts[0].x).toBeLessThan(50);

      // À direita: texto com x > 50
      const rightDim = createLinearDimension({
        start: { x: 50, y: 20 },
        end: { x: 50, y: 80 },
        offset_mm: 8,
        measurement_cm: 60,
        orientation: "vertical",
      });
      const rightTexts = rightDim.filter((p) => p.type === "text");
      expect(rightTexts[0]!.type === "text" && rightTexts[0].x).toBeGreaterThan(50);

      // Horizontal abaixo
      const below = createLinearDimension({
        start: { x: 10, y: 40 },
        end: { x: 90, y: 40 },
        offset_mm: 6,
        measurement_cm: 80,
        orientation: "horizontal",
      });
      const belowText = below.find((p) => p.type === "text");
      expect(belowText?.type === "text" && belowText.y).toBeGreaterThan(40);
    });

    it("corte do bloco: cotas de H e embutimento ficam à esquerda do contorno", () => {
      const sheet = drawPileCapSheet({
        blockResult: mockBlockOf(1.4, 1.4, [0]),
        pileDiameter_m: 0.4,
        titleInfo: {
          projectName: "Obra",
          elementRef: "B-1",
          drawingTitle: "DETALHE — BLOCO",
          scaleLabel: "VER DET.",
          sheetNumber: 2,
          totalSheets: 2,
          date: "14/09/2026",
        },
      });
      const secRects = sheet.primitives.filter(
        (p): p is Extract<typeof p, { type: "rect" }> =>
          p.type === "rect" && p.y >= 108 && p.x < 120 && p.height > 8 && p.width > 20,
      );
      expect(secRects.length).toBeGreaterThan(0);
      const blockRect = secRects.reduce((a, b) => (a.width > b.width ? a : b));
      // Cotas numéricas curtas (H ~50, embutimento 10) no corte, à esquerda do bloco
      const dimTexts = sheet.primitives.filter(
        (p): p is Extract<typeof p, { type: "text" }> =>
          p.type === "text" &&
          p.y >= 108 &&
          p.y <= 200 &&
          /^\d+$/.test(p.text) &&
          p.x < blockRect.x,
      );
      expect(dimTexts.length).toBeGreaterThanOrEqual(2);
    });
  });
});
