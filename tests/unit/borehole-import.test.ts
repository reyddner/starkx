import { describe, expect, it } from "vitest";
import {
  exportBoreholeJson,
  parseBoreholeImport,
} from "../../assist-engine/index";
import { refInput } from "../fixtures/reference";

describe("parseBoreholeImport", () => {
  it("importa JSON de sondagem com preview ok (DEC-28)", () => {
    const text = JSON.stringify({ input: { ...refInput, waterLevel_m: 5 } });
    const p = parseBoreholeImport(text);
    expect(p.ok).toBe(true);
    expect(p.sourceFormat).toBe("json");
    expect(p.layers).toHaveLength(refInput.layers.length);
    expect(p.layers[0]).toEqual({ depth_m: 1, nspt: 3, soilTypeId: 11 });
    expect(p.waterLevel_m).toBe(5);
  });

  it("importa CSV depth_m,nspt,soilTypeId", () => {
    const csv = `depth_m,nspt,soilTypeId
1,10,12
2,15,7
3,20,7`;
    const p = parseBoreholeImport(csv);
    expect(p.ok).toBe(true);
    expect(p.sourceFormat).toBe("csv");
    expect(p.layers).toHaveLength(3);
  });

  it("rejeita soilTypeId inválido", () => {
    const p = parseBoreholeImport(
      JSON.stringify({ layers: [{ depth_m: 1, nspt: 10, soilTypeId: 99 }] }),
    );
    expect(p.ok).toBe(false);
    expect(p.errors.length).toBeGreaterThan(0);
  });

  it("export round-trip", () => {
    const json = exportBoreholeJson({
      layers: [{ depth_m: 1, nspt: 8, soilTypeId: 11 }],
      waterLevel_m: 2,
    });
    const p = parseBoreholeImport(json);
    expect(p.ok).toBe(true);
    expect(p.layers[0]?.nspt).toBe(8);
    expect(p.waterLevel_m).toBe(2);
  });
});
