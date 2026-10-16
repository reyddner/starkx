/**
 * Import de sondagem SPT — parse + validação (DEC-28).
 * Nunca aplica no store nem calcula capacidade — só devolve preview.
 */

export interface BoreholeLayerDraft {
  depth_m: number;
  nspt: number;
  soilTypeId: number;
}

export interface BoreholeImportPreview {
  ok: boolean;
  layers: BoreholeLayerDraft[];
  waterLevel_m: number | null;
  warnings: string[];
  errors: string[];
  sourceFormat: "json" | "csv" | "xlsx" | "unknown";
}

/** Monta preview a partir de camadas já extraídas (JSON/CSV/XLSX). */
export function previewFromLayers(
  raw: BoreholeLayerDraft[],
  waterLevel_m: number | null,
  sourceFormat: BoreholeImportPreview["sourceFormat"],
): BoreholeImportPreview {
  const { layers, warnings, errors } = validateLayers(raw);
  return {
    ok: errors.length === 0,
    layers,
    waterLevel_m,
    warnings,
    errors,
    sourceFormat,
  };
}

const SOIL_ID_MIN = 1;
const SOIL_ID_MAX = 15;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return null;
}

function validateLayers(raw: BoreholeLayerDraft[]): {
  layers: BoreholeLayerDraft[];
  warnings: string[];
  errors: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (raw.length === 0) {
    errors.push("Nenhuma camada SPT encontrada.");
    return { layers: [], warnings, errors };
  }

  const layers = [...raw].sort((a, b) => a.depth_m - b.depth_m);
  for (let i = 0; i < layers.length; i++) {
    const L = layers[i]!;
    if (!(L.depth_m > 0)) errors.push(`Camada ${i + 1}: depth_m deve ser > 0.`);
    if (!(L.nspt >= 0)) errors.push(`Camada ${i + 1}: nspt deve ser ≥ 0.`);
    if (L.soilTypeId < SOIL_ID_MIN || L.soilTypeId > SOIL_ID_MAX) {
      errors.push(
        `Camada ${i + 1}: soilTypeId=${L.soilTypeId} fora do catálogo (${SOIL_ID_MIN}–${SOIL_ID_MAX}).`,
      );
    }
    if (i > 0 && layers[i]!.depth_m <= layers[i - 1]!.depth_m) {
      errors.push(
        `Profundidades devem ser crescentes (m ${layers[i - 1]!.depth_m} → ${layers[i]!.depth_m}).`,
      );
    }
  }

  const depths = new Set(layers.map((l) => Math.round(l.depth_m)));
  if (depths.size !== layers.length) {
    warnings.push("Há profundidades duplicadas (arredondadas) — revise antes de confirmar.");
  }
  if (layers.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < layers.length; i++) {
      gaps.push(layers[i]!.depth_m - layers[i - 1]!.depth_m);
    }
    if (gaps.some((g) => Math.abs(g - 1) > 0.05)) {
      warnings.push(
        "Espaçamento entre camadas ≠ 1 m — o motor geotécnico espera fatias típicas de 1 m.",
      );
    }
  }

  return { layers, warnings, errors };
}

function extractLayersFromJson(data: unknown): {
  layers: BoreholeLayerDraft[];
  waterLevel_m: number | null;
} {
  let root: unknown = data;
  if (isRecord(data) && isRecord(data.input)) root = data.input;
  if (isRecord(data) && isRecord(data.borehole)) root = data.borehole;

  let waterLevel_m: number | null = null;
  let rows: unknown[] = [];

  if (Array.isArray(root)) {
    rows = root;
  } else if (isRecord(root)) {
    waterLevel_m = num(root.waterLevel_m);
    if (Array.isArray(root.layers)) rows = root.layers;
  }

  const layers: BoreholeLayerDraft[] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const depth_m = num(row.depth_m ?? row.depth ?? row.prof_m);
    const nspt = num(row.nspt ?? row.NSPT ?? row.n);
    const soilTypeId = num(row.soilTypeId ?? row.soil_id ?? row.soloId);
    if (depth_m == null || nspt == null || soilTypeId == null) continue;
    layers.push({
      depth_m,
      nspt,
      soilTypeId: Math.round(soilTypeId),
    });
  }
  return { layers, waterLevel_m };
}

function parseCsv(text: string): BoreholeLayerDraft[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
  if (lines.length === 0) return [];

  const header = lines[0]!.toLowerCase();
  const hasHeader =
    header.includes("depth") ||
    header.includes("nspt") ||
    header.includes("prof") ||
    header.includes("soil");
  const start = hasHeader ? 1 : 0;
  const cols = hasHeader
    ? header.split(/[;,]/).map((c) => c.trim().toLowerCase())
    : ["depth_m", "nspt", "soiltypeid"];

  const idx = (names: string[]) => {
    for (const n of names) {
      const i = cols.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const iDepth = idx(["depth_m", "depth", "prof_m", "prof", "profundidade"]);
  const iNspt = idx(["nspt", "n", "spt"]);
  const iSoil = idx(["soiltypeid", "soil_id", "solo", "soil", "tipoid"]);

  const dIdx = iDepth >= 0 ? iDepth : 0;
  const nIdx = iNspt >= 0 ? iNspt : 1;
  const sIdx = iSoil >= 0 ? iSoil : 2;

  const layers: BoreholeLayerDraft[] = [];
  for (let li = start; li < lines.length; li++) {
    const parts = lines[li]!.split(/[;,]/).map((p) => p.trim());
    const depth_m = num(parts[dIdx]);
    const nspt = num(parts[nIdx]);
    const soilTypeId = num(parts[sIdx]);
    if (depth_m == null || nspt == null || soilTypeId == null) continue;
    layers.push({
      depth_m,
      nspt,
      soilTypeId: Math.round(soilTypeId),
    });
  }
  return layers;
}

/** Detecta JSON vs CSV e valida camadas. */
export function parseBoreholeImport(text: string): BoreholeImportPreview {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      ok: false,
      layers: [],
      waterLevel_m: null,
      warnings: [],
      errors: ["Arquivo vazio."],
      sourceFormat: "unknown",
    };
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const data = JSON.parse(trimmed) as unknown;
      const { layers: raw, waterLevel_m } = extractLayersFromJson(data);
      return previewFromLayers(raw, waterLevel_m, "json");
    } catch {
      return {
        ok: false,
        layers: [],
        waterLevel_m: null,
        warnings: [],
        errors: ["JSON inválido."],
        sourceFormat: "json",
      };
    }
  }

  return previewFromLayers(parseCsv(trimmed), null, "csv");
}

/** Serializa camadas atuais para export (JSON STARKX). */
export function exportBoreholeJson(opts: {
  layers: BoreholeLayerDraft[];
  waterLevel_m: number | null;
}): string {
  return JSON.stringify(
    {
      format: "starkx-borehole-v1",
      waterLevel_m: opts.waterLevel_m,
      layers: opts.layers,
    },
    null,
    2,
  );
}
