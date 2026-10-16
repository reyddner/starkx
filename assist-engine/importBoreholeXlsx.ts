/**
 * Import binário .xlsx de sondagem (DEC-29 / DEC-48).
 * ExcelJS no lugar do SheetJS (CVE high). Só parseia → preview.
 */

import ExcelJS from "exceljs";
import {
  previewFromLayers,
  type BoreholeImportPreview,
  type BoreholeLayerDraft,
} from "./importBorehole";

/** Limite defensivo — STX-SEC-003 / DEC-32 */
export const MAX_BOREHOLE_XLSX_BYTES = 2 * 1024 * 1024;
export const MAX_BOREHOLE_XLSX_ROWS = 500;

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object" && v !== null && "text" in v) {
    return String((v as { text: unknown }).text ?? "").trim();
  }
  if (typeof v === "object" && v !== null && "result" in v) {
    return cellStr((v as { result: unknown }).result);
  }
  return String(v).trim();
}

function cellNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return Number(v);
  }
  if (typeof v === "object" && v !== null && "result" in v) {
    return cellNum((v as { result: unknown }).result);
  }
  return null;
}

function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

const DEPTH_KEYS = new Set([
  "depth_m",
  "depth",
  "prof",
  "prof_m",
  "profundidade",
  "profundidade_m",
  "z",
]);
const NSPT_KEYS = new Set(["nspt", "n", "spt", "n_spt"]);
const SOIL_KEYS = new Set([
  "soiltypeid",
  "soil_type_id",
  "soil",
  "solo",
  "tipo_solo",
  "solo_id",
  "id_solo",
]);

function findCol(headers: string[], keys: Set<string>): number {
  for (let i = 0; i < headers.length; i++) {
    if (keys.has(headers[i]!)) return i;
  }
  return -1;
}

/** ExcelJS row.values é 1-indexado. */
function sheetToAoa(ws: ExcelJS.Worksheet): unknown[][] {
  const aoa: unknown[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const values = row.values;
    if (!Array.isArray(values)) {
      aoa.push([]);
      return;
    }
    aoa.push(values.slice(1).map((c) => (c == null ? "" : c)));
  });
  return aoa;
}

function findWorksheet(wb: ExcelJS.Workbook, names: string[]): ExcelJS.Worksheet | undefined {
  const wanted = new Set(names.map(normHeader));
  for (const ws of wb.worksheets) {
    if (wanted.has(normHeader(ws.name))) return ws;
  }
  return undefined;
}

function parseMetaWater(wb: ExcelJS.Workbook): number | null {
  const sheet = findWorksheet(wb, ["meta", "metadata"]);
  if (!sheet) return null;
  const aoa = sheetToAoa(sheet);
  for (const row of aoa) {
    if (row.length < 2) continue;
    const nk = normHeader(cellStr(row[0]));
    if (
      nk === "waterlevel_m" ||
      nk === "water_level_m" ||
      nk === "na" ||
      nk === "nivel_agua" ||
      nk === "nivel_dagua"
    ) {
      return cellNum(row[1]);
    }
  }
  return null;
}

function toArrayBuffer(data: ExcelJS.Buffer | ArrayBuffer | Uint8Array): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data;
  if (typeof Uint8Array !== "undefined" && data instanceof Uint8Array) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  }
  // Node Buffer (duck-type — evita conflito de tipos Buffer vs never no bundler)
  const maybe = data as { buffer?: ArrayBuffer; byteOffset?: number; byteLength?: number };
  if (maybe.buffer instanceof ArrayBuffer && typeof maybe.byteOffset === "number") {
    return maybe.buffer.slice(
      maybe.byteOffset,
      maybe.byteOffset + (maybe.byteLength ?? 0),
    );
  }
  return new Uint8Array(data as ArrayLike<number>).buffer;
}

/** Lê planilha com cabeçalho depth/nspt/soil (async — ExcelJS). */
export async function parseBoreholeXlsx(data: ArrayBuffer): Promise<BoreholeImportPreview> {
  if (data.byteLength > MAX_BOREHOLE_XLSX_BYTES) {
    return {
      ok: false,
      layers: [],
      waterLevel_m: null,
      warnings: [],
      errors: [
        `Arquivo XLSX acima do limite (${MAX_BOREHOLE_XLSX_BYTES / (1024 * 1024)} MiB). Prefira JSON/CSV ou reduza o arquivo.`,
      ],
      sourceFormat: "xlsx",
    };
  }
  if (data.byteLength === 0) {
    return {
      ok: false,
      layers: [],
      waterLevel_m: null,
      warnings: [],
      errors: ["Arquivo XLSX vazio."],
      sourceFormat: "xlsx",
    };
  }

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(data);
  } catch {
    return {
      ok: false,
      layers: [],
      waterLevel_m: null,
      warnings: [],
      errors: ["Arquivo XLSX inválido ou corrompido."],
      sourceFormat: "xlsx",
    };
  }

  if (wb.worksheets.length === 0) {
    return {
      ok: false,
      layers: [],
      waterLevel_m: null,
      warnings: [],
      errors: ["Arquivo sem abas de dados."],
      sourceFormat: "xlsx",
    };
  }

  const dataSheet =
    findWorksheet(wb, ["layers", "camadas", "sondagem", "spt"]) ?? wb.worksheets[0]!;

  const aoa = sheetToAoa(dataSheet);

  let headerIdx = -1;
  let depthCol = -1;
  let nsptCol = -1;
  let soilCol = -1;

  for (let r = 0; r < Math.min(aoa.length, 20); r++) {
    const row = aoa[r];
    if (!row || row.length < 2) continue;
    const headers = row.map((c) => normHeader(cellStr(c)));
    const d = findCol(headers, DEPTH_KEYS);
    const n = findCol(headers, NSPT_KEYS);
    const s = findCol(headers, SOIL_KEYS);
    if (d >= 0 && n >= 0 && s >= 0) {
      headerIdx = r;
      depthCol = d;
      nsptCol = n;
      soilCol = s;
      break;
    }
  }

  if (headerIdx < 0) {
    return {
      ok: false,
      layers: [],
      waterLevel_m: parseMetaWater(wb),
      warnings: [],
      errors: [
        "Cabeçalho não encontrado. Use colunas depth_m / nspt / soilTypeId (ou prof / NSPT / solo).",
      ],
      sourceFormat: "xlsx",
    };
  }

  const raw: BoreholeLayerDraft[] = [];
  for (let r = headerIdx + 1; r < aoa.length; r++) {
    if (raw.length >= MAX_BOREHOLE_XLSX_ROWS) break;
    const row = aoa[r];
    if (!row) continue;
    const depth_m = cellNum(row[depthCol]);
    const nspt = cellNum(row[nsptCol]);
    const soilTypeId = cellNum(row[soilCol]);
    if (depth_m == null && nspt == null && soilTypeId == null) continue;
    if (depth_m == null || nspt == null || soilTypeId == null) {
      raw.push({
        depth_m: depth_m ?? Number.NaN,
        nspt: nspt ?? Number.NaN,
        soilTypeId: soilTypeId ?? Number.NaN,
      });
      continue;
    }
    raw.push({
      depth_m,
      nspt,
      soilTypeId: Math.round(soilTypeId),
    });
  }

  const waterLevel_m = parseMetaWater(wb);
  const preview = previewFromLayers(raw, waterLevel_m, "xlsx");
  preview.warnings.unshift(
    "Importação .xlsx — prefira JSON/CSV quando possível.",
  );
  if (aoa.length - headerIdx - 1 > MAX_BOREHOLE_XLSX_ROWS) {
    preview.warnings.push(`Linhas além de ${MAX_BOREHOLE_XLSX_ROWS} foram ignoradas.`);
  }
  if (waterLevel_m == null) {
    preview.warnings.push(
      "Nível d'água não encontrado (opcional: aba meta com waterLevel_m).",
    );
  }
  return preview;
}

/** Exporta camadas para .xlsx (ArrayBuffer). */
export async function exportBoreholeXlsx(opts: {
  layers: BoreholeLayerDraft[];
  waterLevel_m: number | null;
}): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const wsLayers = wb.addWorksheet("layers");
  wsLayers.addRow(["depth_m", "nspt", "soilTypeId"]);
  for (const l of opts.layers) {
    wsLayers.addRow([l.depth_m, l.nspt, l.soilTypeId]);
  }

  const wsMeta = wb.addWorksheet("meta");
  wsMeta.addRow(["key", "value"]);
  wsMeta.addRow(["waterLevel_m", opts.waterLevel_m]);
  wsMeta.addRow(["format", "starkx-borehole-v1"]);

  const out = await wb.xlsx.writeBuffer();
  return toArrayBuffer(out);
}
