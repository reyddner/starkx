import { describe, expect, it } from "vitest";
import { cmToM, cm2ToM2, mPaToKPa, kNToTf } from "@engine/units";
import { resolveGeometry } from "@engine/piles/geometry";
import { decourtAlphaBetaPct } from "@engine/catalogs";

describe("units", () => {
  it("converte cm, cm², MPa, kN↔tf", () => {
    expect(cmToM(30)).toBeCloseTo(0.3, 12);
    expect(cm2ToM2(10000)).toBeCloseTo(1, 12);
    expect(mPaToKPa(0.35)).toBeCloseTo(350, 12);
    expect(kNToTf(9.81)).toBeCloseTo(1, 12);
  });
});

describe("geometry", () => {
  it("escavada Ø30", () => {
    const g = resolveGeometry({ pileTypeId: 6, diameterCm: 30 });
    expect(g.area_m2).toBeCloseTo(0.07068583470577035, 12);
    expect(g.perimeter_m).toBeCloseTo(0.9424777960769379, 12);
  });

  it("rejeita D>200", () => {
    expect(() => resolveGeometry({ pileTypeId: 6, diameterCm: 201 })).toThrow(/Diametro/);
  });
});

describe("DEC-02 α/β auto", () => {
  it("escavada em argila → 85/80", () => {
    expect(decourtAlphaBetaPct(12, 6)).toEqual({ alphaPct: 85, betaPct: 80 });
  });
  it("franki → 100/100", () => {
    expect(decourtAlphaBetaPct(12, 9)).toEqual({ alphaPct: 100, betaPct: 100 });
  });
});
