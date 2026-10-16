import { describe, it, expect } from "vitest";
import {
  getSteelWeightPerMeter,
  defaultSteelGrade,
  computePileTakeoff,
  computeBlockTakeoff,
  aggregateProjectTakeoff,
} from "../../structural-engine/takeoff";

describe("structural-engine takeoff module", () => {
  it("retorna massas lineares corretas NBR 7480", () => {
    expect(getSteelWeightPerMeter(4.2)).toBe(0.109);
    expect(getSteelWeightPerMeter(8.0)).toBe(0.395);
    expect(getSteelWeightPerMeter(10.0)).toBe(0.617);
    expect(getSteelWeightPerMeter(12.5)).toBe(0.963);
    expect(getSteelWeightPerMeter(16.0)).toBe(1.578);
    expect(getSteelWeightPerMeter(20.0)).toBe(2.466);
    expect(defaultSteelGrade(4.2)).toBe("CA-60");
    expect(defaultSteelGrade(10.0)).toBe("CA-50");
  });

  it("calcula quantitativo de estaca circular", () => {
    // Estaca 50cm, L = 6.50m, 8Ø12.5, estribos Ø8 c/ 15cm
    const pile = computePileTakeoff({
      elementRef: "ESTACA 50cm (P-5)",
      diameter_m: 0.50,
      length_m: 6.50,
      longitudinalCount: 8,
      longitudinalDia_mm: 12.5,
      transverseDia_mm: 8.0,
      transverseSpacing_m: 0.15,
      cover_m: 0.05,
      concreteGrade: "C20",
    });

    expect(pile.elementKind).toBe("pile");
    expect(pile.concreteGrade).toBe("C20");
    // Volume: pi * 0.25^2 * 6.50 = 1.276 -> 1.28 m³
    expect(pile.concreteVolume_m3).toBeCloseTo(1.28, 2);
    expect(pile.leanConcreteVolume_m3).toBe(0);

    // Armadura longitudinal: 8 barras
    const vert = pile.items.find((i) => i.name.includes("vertical"));
    expect(vert).toBeDefined();
    expect(vert?.count).toBe(8);
    expect(vert?.diameter_mm).toBe(12.5);

    // Armadura estribos
    const estribos = pile.items.find((i) => i.name.includes("estribos"));
    expect(estribos).toBeDefined();
    expect(estribos?.diameter_mm).toBe(8.0);

    // Totais com perdas de 10%
    expect(pile.totalSteelWeight_kg).toBeGreaterThan(0);
    expect(pile.totalSteelWithLosses_kg).toBeCloseTo(pile.totalSteelWeight_kg * 1.10, 1);
  });

  it("calcula quantitativo de bloco de 1 estaca com estribos e armadura diagonal", () => {
    // Bloco 1 estaca: 1.00m x 1.00m x 0.60m
    const block = computeBlockTakeoff({
      elementRef: "P-5",
      pileCount: 1,
      width_m: 1.00,
      length_m: 1.00,
      thickness_m: 0.60,
      cover_m: 0.05,
      concreteGrade: "C30",
    });

    expect(block.concreteVolume_m3).toBe(0.60);
    expect(block.leanConcreteVolume_m3).toBe(0.10); // 10 cm concreto magro

    // Deve conter armadura diagonal CA-60 Ø4.2 e estribos CA-50 Ø10
    const diag = block.items.find((i) => i.name.includes("diagonal"));
    expect(diag).toBeDefined();
    expect(diag?.diameter_mm).toBe(4.2);
    expect(diag?.steelGrade).toBe("CA-60");

    const xy = block.items.find((i) => i.name.includes("XY"));
    expect(xy).toBeDefined();
    expect(xy?.diameter_mm).toBe(10);
    expect(xy?.steelGrade).toBe("CA-50");
  });

  it("consolida resumo de medição do projeto (quadro de aço por diâmetro e concreto)", () => {
    const pile = computePileTakeoff({
      diameter_m: 0.50,
      length_m: 6.50,
      longitudinalCount: 8,
      longitudinalDia_mm: 12.5,
      transverseDia_mm: 8.0,
      transverseSpacing_m: 0.15,
    });
    const block = computeBlockTakeoff({
      pileCount: 1,
      width_m: 1.00,
      length_m: 1.00,
      thickness_m: 0.60,
    });

    const summary = aggregateProjectTakeoff([block, pile]);
    expect(summary.elements.length).toBe(2);
    expect(summary.concreteByGrade_m3["C30"]).toBe(0.60);
    expect(summary.concreteByGrade_m3["C20"]).toBeCloseTo(1.28, 2);
    expect(summary.totalLeanConcrete_m3).toBe(0.10);
    expect(summary.totalSteel_kg).toBeGreaterThan(0);
    expect(summary.totalCA50_kg).toBeGreaterThan(0);
    expect(summary.totalCA60_kg).toBeGreaterThan(0);
  });

  it("integra storeToMemorialInput gerando resumo e corte/dobra para bloco e estacas", async () => {
    const { storeToMemorialInput } = await import("../../apps/web/src/memorial/fromStore");
    const { designPileReinforcement } = await import("@structural/index");
    const { designPileCap } = await import("@block/index");

    const structural = designPileReinforcement({
      pileTypeId: 6,
      diameter_m: 0.40,
      tipDepth_m: 5.0,
      Nk_kN: 300,
      loadIsDesign: false,
    });

    const blockResult = designPileCap({
      spacing_m: 1.20,
      diameter_m: 0.40,
      singlePadm_kN: 250,
      rows: 1,
      cols: 2,
      edge_m: 0.25,
      thickness_m: 0.70,
      groupLoad_kN: 450,
    });

    const memInput = storeToMemorialInput({
      projectName: "Edifício Teste",
      projectCode: "CYP-01",
      client: "Engenharia",
      location: "SP",
      pileTypeId: 6,
      diameterCm: 40,
      tipDepth_m: 5.0,
      areaCm2: "",
      perimeterCm: "",
      waterLevel_m: null,
      layers: [],
      designLoad_kN: 450,
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
      blockCols: 2,
      blockEdge_m: 0.25,
      result: null,
      structural,
      blockResult,
      footingResult: null,
      caissonResult: null,
      raftResult: null,
      footingShape: "square",
      footingAdmMode: "user",
      foundationKind: "pile_cap",
    });

    expect(memInput.elementTakeoffs).toBeDefined();
    // 1 bloco + 2 estacas = 3 elementos
    expect(memInput.elementTakeoffs?.length).toBe(3);
    expect(memInput.takeoffSummary).toBeDefined();
    expect(memInput.takeoffSummary?.totalSteel_kg).toBeGreaterThan(0);
    expect(memInput.takeoffSummary?.totalLeanConcrete_m3).toBeGreaterThan(0);
  });
});
