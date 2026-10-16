import { describe, expect, it } from "vitest";
import {
  exportBoreholeXlsx,
  parseBoreholeXlsx,
} from "../../assist-engine/importBoreholeXlsx";
import {
  exportProjectSnapshot,
  parseProjectSnapshot,
  PROJECT_SNAPSHOT_FORMAT,
} from "../../assist-engine/projectIo";

describe("parseBoreholeXlsx (DEC-29 / DEC-48)", () => {
  it("round-trip xlsx layers + meta NA", async () => {
    const buf = await exportBoreholeXlsx({
      layers: [
        { depth_m: 1, nspt: 14, soilTypeId: 12 },
        { depth_m: 2, nspt: 21, soilTypeId: 12 },
      ],
      waterLevel_m: 3.5,
    });
    const p = await parseBoreholeXlsx(buf);
    expect(p.ok).toBe(true);
    expect(p.sourceFormat).toBe("xlsx");
    expect(p.layers).toHaveLength(2);
    expect(p.waterLevel_m).toBe(3.5);
    expect(p.layers[0]).toEqual({ depth_m: 1, nspt: 14, soilTypeId: 12 });
  });

  it("rejeita planilha sem cabeçalho", async () => {
    const empty = new ArrayBuffer(8);
    const p = await parseBoreholeXlsx(empty);
    expect(p.ok).toBe(false);
    expect(p.sourceFormat).toBe("xlsx");
  });

  it("rejeita XLSX acima do limite de tamanho (DEC-32)", async () => {
    const { MAX_BOREHOLE_XLSX_BYTES } = await import(
      "../../assist-engine/importBoreholeXlsx"
    );
    const big = new ArrayBuffer(MAX_BOREHOLE_XLSX_BYTES + 1);
    const p = await parseBoreholeXlsx(big);
    expect(p.ok).toBe(false);
    expect(p.errors.join(" ")).toMatch(/limite/i);
  });

  it("avisa preferir JSON/CSV no import ok", async () => {
    const buf = await exportBoreholeXlsx({
      layers: [{ depth_m: 1, nspt: 10, soilTypeId: 12 }],
      waterLevel_m: null,
    });
    const p = await parseBoreholeXlsx(buf);
    expect(p.ok).toBe(true);
    expect(p.warnings.some((w) => /JSON\/CSV/i.test(w))).toBe(true);
    expect(p.warnings.some((w) => /\.xlsx/i.test(w))).toBe(true);
  });
});

describe("project snapshot (DEC-29)", () => {
  const base = {
    foundationKind: "pile",
    projectName: "Obra teste",
    projectCode: "T-01",
    client: "Cliente",
    location: "SP",
    pileTypeId: 1,
    diameterCm: 30,
    tipDepth_m: 8,
    areaCm2: "",
    perimeterCm: "",
    enlargedBaseVolumeLiters: "",
    waterLevel_m: null as number | null,
    layers: [{ depth_m: 1, nspt: 10, soilTypeId: 12 }],
    designLoad_kN: 400,
    mode: "engineering",
    governingRule: "minimum",
    selectedMethod: "aoki_velloso",
    aokiFs: 2,
    aokiPctTip: 100,
    aokiPctShaft: 100,
    decourtAlphaPct: null as number | null,
    decourtBetaPct: null as number | null,
    teixeiraFs: 2,
    teixeiraPctTip: 100,
    teixeiraPctShaft: 100,
    fck_MPa: 25,
    fyk_MPa: 500,
    cover_mm: 30,
    loadIsDesign: true,
    transverseKind: "stirrup" as const,
    blockRows: 2,
    blockCols: 2,
    blockSpacing_m: null as number | null,
    blockEdge_m: 0.15,
    blockThickness_m: 0.6,
    blockEmbedment_m: 0.1,
    blockEfficiency: null as number | null,
    footingShape: "rectangular",
    footingAdmMode: "sigma_adm",
    footingSigmaAdm_kPa: 200,
    footingAspect: 1,
    footingThickness_m: null as number | null,
    footingC_kPa: 0,
    footingPhi_deg: 30,
    footingGamma_kN_m3: 18,
    footingDf_m: 1,
    footingFs: 3,
    footingMx_kNm: null as number | null,
    footingMy_kNm: null as number | null,
    caissonShaftDia_m: 0.8,
    caissonBaseDia_m: null as number | null,
    caissonLength_m: 8,
    caissonAdmMode: "sigma_adm",
    caissonSigmaAdm_kPa: 400,
    caissonC_kPa: 0,
    caissonPhi_deg: 30,
    caissonGamma_kN_m3: 18,
    caissonFsTip: 2,
    caissonUnitFriction_kPa: 40,
    caissonShaftFS: 2,
    caissonShaftMode: "user",
    raftAspect: 1,
    raftAdmMode: "sigma_adm",
    raftSigmaAdm_kPa: 150,
    raftThickness_m: null as number | null,
    raftC_kPa: 0,
    raftPhi_deg: 30,
    raftGamma_kN_m3: 18,
    raftDf_m: 1,
    raftFs: 3,
    raftMx_kNm: null as number | null,
    raftMy_kNm: null as number | null,
  };

  it("round-trip export/parse", () => {
    const json = exportProjectSnapshot(base);
    expect(json).toContain(PROJECT_SNAPSHOT_FORMAT);
    const p = parseProjectSnapshot(json);
    expect(p.ok).toBe(true);
    expect(p.data?.projectCode).toBe("T-01");
    expect(p.data?.layers).toHaveLength(1);
    expect(p.data?.designLoad_kN).toBe(400);
  });

  it("ignora resultados embutidos com warning", () => {
    const dirty = {
      format: PROJECT_SNAPSHOT_FORMAT,
      ...base,
      result: { Padm: 999 },
    };
    const p = parseProjectSnapshot(JSON.stringify(dirty));
    expect(p.ok).toBe(true);
    expect(p.warnings.some((w) => w.includes("resultados"))).toBe(true);
  });

  it("rejeita foundationKind inválido", () => {
    const p = parseProjectSnapshot(
      JSON.stringify({ ...base, format: PROJECT_SNAPSHOT_FORMAT, foundationKind: "bridge" }),
    );
    expect(p.ok).toBe(false);
  });
});
