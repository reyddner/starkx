import { describe, expect, it } from "vitest";
import { frankiSphereRadius_m as frankiEngine } from "@engine/piles/geometry";
import {
  frankiSphereRadius_m,
  layersToSlices,
  soilColorHex,
} from "../../apps/web/src/viz3d/coords";
import { soilFillCssVar, soilVisualFamily } from "../../apps/web/src/viz/soilVisual";

describe("viz3d coords helpers", () => {
  it("converte depth_m em fatias top/bottom", () => {
    const slices = layersToSlices([
      { depth_m: 1, nspt: 10, soilTypeId: 12 },
      { depth_m: 3, nspt: 20, soilTypeId: 7 },
    ]);
    expect(slices).toEqual([
      { top_m: 0, bottom_m: 1, soilTypeId: 12, nspt: 10 },
      { top_m: 1, bottom_m: 3, soilTypeId: 7, nspt: 20 },
    ]);
  });

  it("raio Franki alinhado ao calculation-engine", () => {
    const liters = (4 / 3) * Math.PI * 1000;
    const r = frankiSphereRadius_m(liters);
    expect(r).toBeCloseTo(1, 6);
    expect(frankiSphereRadius_m(0)).toBe(0);
    expect(r).toBeCloseTo(frankiEngine(liters), 12);
  });

  it("famílias de solo 2D/3D coerentes", () => {
    expect(soilVisualFamily(3)).toBe("sand");
    expect(soilVisualFamily(8)).toBe("silt");
    expect(soilVisualFamily(12)).toBe("clay");
    expect(soilFillCssVar(3)).toBe("var(--soil-sand)");
    expect(soilColorHex(3, "light")).toMatch(/^#/);
  });
});
