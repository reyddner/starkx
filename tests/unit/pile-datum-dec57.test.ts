import { describe, expect, it } from "vitest";
import { resolvePileDatum, hasSptAtTipDepth, suggestPileLengthForSpt } from "@domain/pileDatum";
import { calculate } from "@engine/index";
import { preprocessSpt } from "@engine/soil/preprocess-spt";

describe("DEC-57 resolvePileDatum", () => {
  it("pile_cap: t=1 e e=0,10 → topo −0,90 e sptTip = 0,90+L", () => {
    const d = resolvePileDatum({
      foundationKind: "pile_cap",
      tipDepth_m: 8,
      blockThickness_m: 1,
      blockEmbedment_m: 0.1,
    });
    expect(d.pileTop_z).toBeCloseTo(-0.9, 9);
    expect(d.pileTopDepth_m).toBeCloseTo(0.9, 9);
    expect(d.pileLength_m).toBe(8);
    expect(d.sptTipDepth_m).toBeCloseTo(8.9, 9);
    expect(d.pileTip_z).toBeCloseTo(-8.9, 9);
  });

  it("pile isolada: topo editável (default 0)", () => {
    const d = resolvePileDatum({
      foundationKind: "pile",
      tipDepth_m: 4,
      blockThickness_m: 0.5,
      blockEmbedment_m: 0.1,
      pileTopElevation_m: 0,
    });
    expect(d.pileTop_z).toBe(0);
    expect(d.sptTipDepth_m).toBe(4);
  });

  it("hasSptAtTipDepth com fracionário", () => {
    expect(hasSptAtTipDepth([{ depth_m: 1.45 }, { depth_m: 4.9 }], 4.9)).toBe(true);
    expect(hasSptAtTipDepth([{ depth_m: 1.45 }], 4.9)).toBe(false);
  });
});

describe("DEC-57 suggestPileLengthForSpt", () => {
  const layers = [
    { depth_m: 1 },
    { depth_m: 2 },
    { depth_m: 3 },
    { depth_m: 4 },
    { depth_m: 5 },
    { depth_m: 6 },
  ];

  it("não altera L se já há camada na ponta", () => {
    const r = suggestPileLengthForSpt({
      foundationKind: "pile",
      tipDepth_m: 4,
      blockThickness_m: 0.5,
      blockEmbedment_m: 0.1,
      pileTopElevation_m: 0,
      layers,
    });
    expect(r.snapped).toBe(false);
    expect(r.tipDepth_m).toBe(4);
  });

  it("pile_cap: L=4 e topo 0,90 → alinha à camada 5 (L=4,1)", () => {
    const r = suggestPileLengthForSpt({
      foundationKind: "pile_cap",
      tipDepth_m: 4,
      blockThickness_m: 1,
      blockEmbedment_m: 0.1,
      layers,
    });
    // sptTip desejado 4,9 → mais próximo é 5 → L = 4,1
    expect(r.snapped).toBe(true);
    expect(r.sptTipDepth_m).toBe(5);
    expect(r.tipDepth_m).toBeCloseTo(4.1, 9);
  });
});

describe("DEC-57 preprocessSpt engineering fracionário", () => {
  it("monta fatias Δh e shaftThickness com topo offset", () => {
    const rows = preprocessSpt(
      [
        { depth_m: 1.45, nspt: 10, soilTypeId: 12 },
        { depth_m: 2.45, nspt: 12, soilTypeId: 12 },
        { depth_m: 3.45, nspt: 14, soilTypeId: 7 },
      ],
      3.45,
      30,
      { pileTopDepth_m: 0.9 },
    );
    expect(rows).toHaveLength(3);
    expect(rows[0]!.thickness_m).toBeCloseTo(1.45, 9);
    // fatia 0→1,45: shaft só abaixo de 0,90 → 0,55 m
    expect(rows[0]!.shaftThickness_m).toBeCloseTo(0.55, 9);
    expect(rows[1]!.thickness_m).toBeCloseTo(1, 9);
    expect(rows[1]!.shaftThickness_m).toBeCloseTo(1, 9);
  });
});

describe("DEC-57 calculate engineering L fracionário + offset", () => {
  it("aceita L fracionário com camada na cota SPT", () => {
    const layers = [
      { depth_m: 1, nspt: 10, soilTypeId: 12 },
      { depth_m: 2, nspt: 12, soilTypeId: 12 },
      { depth_m: 3, nspt: 14, soilTypeId: 12 },
      { depth_m: 4, nspt: 16, soilTypeId: 7 },
      { depth_m: 4.9, nspt: 18, soilTypeId: 7 },
      { depth_m: 5.9, nspt: 20, soilTypeId: 7 },
      { depth_m: 6.9, nspt: 22, soilTypeId: 7 },
    ];
    // pileTopDepth 0,9 + L 4,0 = 4,9
    const r = calculate({
      pileTypeId: 6,
      diameterCm: 30,
      tipDepth_m: 4,
      pileTopDepth_m: 0.9,
      layers,
      mode: "engineering",
      governingRule: "minimum",
      methods: ["aoki_velloso"],
    });
    expect(r.atTip.governingPadm_kN).toBeGreaterThan(0);
    expect(r.profile.at(-1)!.depth_m).toBeCloseTo(4.9, 6);
  });
});
