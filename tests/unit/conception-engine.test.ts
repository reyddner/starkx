import { describe, expect, it } from "vitest";
import {
  interpretSoilProfile,
  optimizePileSolution,
  standardizeDiameterCm,
} from "../../conception-engine/index";

import { refInput } from "../fixtures/reference";

const refLayers = refInput.layers;

describe("interpretSoilProfile", () => {
  it("identifica zonas e solo raso fraco no perfil de referência (argila mole)", () => {
    const p = interpretSoilProfile(refLayers);
    expect(p.layerCount).toBe(refLayers.length);
    expect(p.maxDepth_m).toBe(12);
    expect(p.zones.length).toBeGreaterThan(0);
    expect(p.weakShallow).toBe(true);
    expect(["high", "medium", "low"]).toContain(p.confidence);
  });

  it("marca solo raso fraco quando NSPT baixo", () => {
    const p = interpretSoilProfile([
      { depth_m: 1, nspt: 2 },
      { depth_m: 2, nspt: 3 },
      { depth_m: 3, nspt: 4 },
      { depth_m: 8, nspt: 25 },
    ]);
    expect(p.weakShallow).toBe(true);
    expect(p.resistantOnset_m).not.toBeNull();
  });
});

describe("standardizeDiameterCm", () => {
  it("escolhe a maioria (10×30 vs 5×50 → 30)", () => {
    const ds = [...Array(10).fill(30), ...Array(5).fill(50)];
    expect(standardizeDiameterCm(ds)).toBe(30);
  });

  it("em empate prefere o menor Ø", () => {
    expect(standardizeDiameterCm([40, 50, 40, 50])).toBe(40);
  });
});

describe("optimizePileSolution", () => {
  it("retorna recomendação viável para o perfil de referência com carga moderada", () => {
    const r = optimizePileSolution({
      layers: refLayers,
      N_kN: 150,
      preferredPileTypeId: 6,
      mode: "engineering",
      governingRule: "minimum",
      waterLevel_m: null,
    });
    expect(r.evaluatedCount).toBeGreaterThan(0);
    expect(r.recommended).not.toBeNull();
    expect(r.recommended!.ok).toBe(true);
    expect(r.recommended!.nPiles).toBeGreaterThanOrEqual(1);
    expect(r.recommended!.diameterCm).toBeGreaterThan(0);
    expect(r.recommended!.tipDepth_m).toBeGreaterThanOrEqual(3);
    expect(r.alternatives.some((a) => a.role === "recommended")).toBe(true);
  });

  it("com carga grande e Ø fixo 30 cm sugere várias estacas", () => {
    const r = optimizePileSolution({
      layers: refLayers,
      N_kN: 900,
      preferredPileTypeId: 6,
      fixedDiameterCm: 30,
      mode: "engineering",
      governingRule: "minimum",
      waterLevel_m: null,
    });
    expect(r.recommended).not.toBeNull();
    expect(r.recommended!.nPiles).toBeGreaterThanOrEqual(2);
    expect(r.recommended!.efficiency).toBeLessThan(1);
  });

  it("não recomenda diâmetros abaixo de 25 cm", () => {
    const r = optimizePileSolution({
      layers: [
        { depth_m: 1, nspt: 2, soilTypeId: 12 },
        { depth_m: 2, nspt: 3, soilTypeId: 12 },
        { depth_m: 3, nspt: 12, soilTypeId: 12 },
        { depth_m: 5, nspt: 20, soilTypeId: 12 },
        { depth_m: 8, nspt: 30, soilTypeId: 12 },
      ],
      N_kN: 1500,
      preferredPileTypeId: 6,
      mode: "engineering",
      governingRule: "minimum",
      waterLevel_m: 10,
    });
    expect(r.recommended).not.toBeNull();
    expect(r.recommended!.diameterCm).toBeGreaterThanOrEqual(25);
    expect(r.recommended!.diameterCm).toBeLessThanOrEqual(80);
    expect(r.topOptions.length).toBeGreaterThan(1);
    expect(r.topOptions.every((c) => c.diameterCm >= 25)).toBe(true);
  });

  it("carga pequena: prefere apoio em camada resistente a estaca fina e longa (DEC-58)", () => {
    // Argila mole até 6 m e areia densa a partir de 7 m: a estaca deve buscar a
    // camada competente e não ficar esbelta flutuando no trecho mole.
    const layers = [
      { depth_m: 1, nspt: 3, soilTypeId: 12 },
      { depth_m: 2, nspt: 3, soilTypeId: 12 },
      { depth_m: 3, nspt: 4, soilTypeId: 12 },
      { depth_m: 4, nspt: 4, soilTypeId: 12 },
      { depth_m: 5, nspt: 5, soilTypeId: 12 },
      { depth_m: 6, nspt: 6, soilTypeId: 12 },
      { depth_m: 7, nspt: 26, soilTypeId: 2 },
      { depth_m: 8, nspt: 30, soilTypeId: 2 },
      { depth_m: 9, nspt: 34, soilTypeId: 2 },
      { depth_m: 10, nspt: 38, soilTypeId: 2 },
    ];
    const r = optimizePileSolution({
      layers,
      N_kN: 320,
      preferredPileTypeId: 6,
      mode: "engineering",
      governingRule: "minimum",
      waterLevel_m: null,
    });
    expect(r.recommended).not.toBeNull();
    const rec = r.recommended!;
    expect(rec.bearsOnResistantLayer).toBe(true);
    expect(rec.tipNspt).toBeGreaterThanOrEqual(25);
    expect(rec.slenderness).toBeLessThanOrEqual(50);
    expect(rec.scoreBreakdown.bearing).toBeGreaterThan(5);
  });

  it("sondagem rasa ainda avalia candidatos sob bloco (L pode ser < 3 m)", () => {
    const r = optimizePileSolution({
      layers: [
        { depth_m: 1, nspt: 8, soilTypeId: 12 },
        { depth_m: 2, nspt: 10, soilTypeId: 12 },
        { depth_m: 3, nspt: 14, soilTypeId: 12 },
      ],
      N_kN: 180,
      preferredPileTypeId: 6,
      pileTopDepthCap_m: 0.4,
      mode: "engineering",
      governingRule: "minimum",
    });
    expect(r.evaluatedCount).toBeGreaterThan(0);
    expect(r.summary).not.toMatch(/Nenhuma solução viável encontrada com o perfil/);
  });

  it("respeita fixedDiameterCm na padronização", () => {
    const r = optimizePileSolution({
      layers: refLayers,
      N_kN: 400,
      preferredPileTypeId: 6,
      fixedDiameterCm: 30,
      mode: "engineering",
      governingRule: "minimum",
      waterLevel_m: null,
    });
    expect(r.recommended).not.toBeNull();
    expect(r.recommended!.diameterCm).toBe(30);
  });
});
