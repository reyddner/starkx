/**
 * Snapshot do projeto (inputs) — export/import JSON (DEC-29).
 * Nunca inclui resultados de motor; import só devolve preview para confirmação.
 */

export const PROJECT_SNAPSHOT_FORMAT = "starkx-project-v1" as const;

const FOUNDATION_KINDS = new Set([
  "pile",
  "pile_cap",
  "footing",
  "caisson",
  "raft",
]);
const MODES = new Set(["engineering"]);
const GOVERNING = new Set([
  "average",
  "minimum",
  "aoki_velloso",
  "decourt_quisante",
  "teixeira",
  "user_selected",
]);

/** Campos persistíveis de input (espelha partialize do store, sem resultados). */
export type ProjectSnapshotFields = {
  theme?: "light" | "dark";
  foundationKind: string;
  projectName: string;
  projectCode: string;
  client: string;
  location: string;
  pileTypeId: number;
  diameterCm: number;
  tipDepth_m: number;
  areaCm2: string;
  perimeterCm: string;
  enlargedBaseVolumeLiters: string;
  waterLevel_m: number | null;
  layers: { depth_m: number; nspt: number; soilTypeId: number }[];
  designLoad_kN: number | null;
  mode: string;
  governingRule: string;
  selectedMethod: string;
  aokiFs: number;
  aokiPctTip: number;
  aokiPctShaft: number;
  decourtAlphaPct: number | null;
  decourtBetaPct: number | null;
  teixeiraFs: number;
  teixeiraPctTip: number;
  teixeiraPctShaft: number;
  fck_MPa: number | null;
  fyk_MPa: number;
  cover_mm: number;
  loadIsDesign: boolean;
  transverseKind: "stirrup" | "spiral";
  blockRows: number;
  blockCols: number;
  blockSpacing_m: number | null;
  blockEdge_m: number;
  blockThickness_m: number;
  blockEmbedment_m: number;
  blockEfficiency: number | null;
  footingShape: string;
  footingAdmMode: string;
  footingSigmaAdm_kPa: number;
  footingAspect: number;
  footingThickness_m: number | null;
  footingC_kPa: number;
  footingPhi_deg: number;
  footingGamma_kN_m3: number;
  footingDf_m: number;
  footingFs: number;
  footingMx_kNm: number | null;
  footingMy_kNm: number | null;
  caissonShaftDia_m: number;
  caissonBaseDia_m: number | null;
  caissonLength_m: number;
  caissonAdmMode: string;
  caissonSigmaAdm_kPa: number;
  caissonC_kPa: number;
  caissonPhi_deg: number;
  caissonGamma_kN_m3: number;
  caissonFsTip: number;
  caissonUnitFriction_kPa: number;
  caissonShaftFS: number;
  caissonShaftMode: string;
  raftAspect: number;
  raftAdmMode: string;
  raftSigmaAdm_kPa: number;
  raftThickness_m: number | null;
  raftC_kPa: number;
  raftPhi_deg: number;
  raftGamma_kN_m3: number;
  raftDf_m: number;
  raftFs: number;
  raftMx_kNm: number | null;
  raftMy_kNm: number | null;
};

export interface ProjectImportPreview {
  ok: boolean;
  data: ProjectSnapshotFields | null;
  errors: string[];
  warnings: string[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asNum(v: unknown, label: string, errors: string[]): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v === null || v === undefined) return null;
  errors.push(`Campo ${label} deve ser número.`);
  return null;
}

function asStr(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

/** Serializa inputs do projeto (sem Padm/As/resultados). */
export function exportProjectSnapshot(fields: ProjectSnapshotFields): string {
  return JSON.stringify(
    {
      format: PROJECT_SNAPSHOT_FORMAT,
      ...fields,
    },
    null,
    2,
  );
}

/** Valida snapshot; nunca aplica no store. */
export function parseProjectSnapshot(text: string): ProjectImportPreview {
  const errors: string[] = [];
  const warnings: string[] = [];
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, data: null, errors: ["Arquivo vazio."], warnings };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed) as unknown;
  } catch {
    return { ok: false, data: null, errors: ["JSON inválido."], warnings };
  }

  if (!isRecord(raw)) {
    return {
      ok: false,
      data: null,
      errors: ["Snapshot deve ser um objeto."],
      warnings,
    };
  }

  if (raw.format !== PROJECT_SNAPSHOT_FORMAT) {
    warnings.push(
      `format esperado ${PROJECT_SNAPSHOT_FORMAT}; recebido ${String(raw.format ?? "(ausente)")}.`,
    );
  }

  if ("result" in raw || "structural" in raw || "blockResult" in raw) {
    warnings.push(
      "Snapshot contém resultados de motor — serão ignorados (só inputs são importados).",
    );
  }

  const foundationKind = asStr(raw.foundationKind, "pile");
  if (!FOUNDATION_KINDS.has(foundationKind)) {
    errors.push(`foundationKind inválido: ${foundationKind}`);
  }

  // Modo de compatibilidade antigo → modo único (DEC-62).
  const rawMode = asStr(raw.mode, "engineering");
  const mode = rawMode === "excel_legacy" ? "engineering" : rawMode;
  if (!MODES.has(mode)) {
    errors.push(`mode inválido: ${mode}`);
  }

  const governingRule = asStr(raw.governingRule, "minimum");
  if (!GOVERNING.has(governingRule)) {
    errors.push(`governingRule inválido: ${governingRule}`);
  }

  const layersRaw = raw.layers;
  if (!Array.isArray(layersRaw) || layersRaw.length === 0) {
    errors.push("layers deve ser um array não vazio.");
  }

  const layers: ProjectSnapshotFields["layers"] = [];
  if (Array.isArray(layersRaw)) {
    for (let i = 0; i < layersRaw.length; i++) {
      const L = layersRaw[i];
      if (!isRecord(L)) {
        errors.push(`layers[${i}] inválida.`);
        continue;
      }
      const depth_m = asNum(L.depth_m, `layers[${i}].depth_m`, errors);
      const nspt = asNum(L.nspt, `layers[${i}].nspt`, errors);
      const soilTypeId = asNum(L.soilTypeId, `layers[${i}].soilTypeId`, errors);
      if (depth_m == null || nspt == null || soilTypeId == null) continue;
      layers.push({
        depth_m,
        nspt,
        soilTypeId: Math.round(soilTypeId),
      });
    }
  }

  const transverse =
    raw.transverseKind === "spiral" ? "spiral" : "stirrup";

  const theme =
    raw.theme === "dark" || raw.theme === "light" ? raw.theme : undefined;

  const data: ProjectSnapshotFields = {
    ...(theme ? { theme } : {}),
    foundationKind,
    projectName: asStr(raw.projectName),
    projectCode: asStr(raw.projectCode),
    client: asStr(raw.client),
    location: asStr(raw.location),
    pileTypeId: asNum(raw.pileTypeId, "pileTypeId", errors) ?? 1,
    diameterCm: asNum(raw.diameterCm, "diameterCm", errors) ?? 30,
    tipDepth_m: asNum(raw.tipDepth_m, "tipDepth_m", errors) ?? 1,
    areaCm2: asStr(raw.areaCm2),
    perimeterCm: asStr(raw.perimeterCm),
    enlargedBaseVolumeLiters: asStr(raw.enlargedBaseVolumeLiters),
    waterLevel_m:
      raw.waterLevel_m === null
        ? null
        : (asNum(raw.waterLevel_m, "waterLevel_m", errors) ?? null),
    layers,
    designLoad_kN:
      raw.designLoad_kN === null
        ? null
        : (asNum(raw.designLoad_kN, "designLoad_kN", errors) ?? null),
    mode,
    governingRule,
    selectedMethod: asStr(raw.selectedMethod, "aoki_velloso"),
    aokiFs: asNum(raw.aokiFs, "aokiFs", errors) ?? 2,
    aokiPctTip: asNum(raw.aokiPctTip, "aokiPctTip", errors) ?? 100,
    aokiPctShaft: asNum(raw.aokiPctShaft, "aokiPctShaft", errors) ?? 100,
    decourtAlphaPct:
      raw.decourtAlphaPct === null
        ? null
        : (asNum(raw.decourtAlphaPct, "decourtAlphaPct", errors) ?? null),
    decourtBetaPct:
      raw.decourtBetaPct === null
        ? null
        : (asNum(raw.decourtBetaPct, "decourtBetaPct", errors) ?? null),
    teixeiraFs: asNum(raw.teixeiraFs, "teixeiraFs", errors) ?? 2,
    teixeiraPctTip: asNum(raw.teixeiraPctTip, "teixeiraPctTip", errors) ?? 100,
    teixeiraPctShaft: asNum(raw.teixeiraPctShaft, "teixeiraPctShaft", errors) ?? 100,
    fck_MPa:
      raw.fck_MPa === null
        ? null
        : (asNum(raw.fck_MPa, "fck_MPa", errors) ?? null),
    fyk_MPa: asNum(raw.fyk_MPa, "fyk_MPa", errors) ?? 500,
    cover_mm: asNum(raw.cover_mm, "cover_mm", errors) ?? 30,
    loadIsDesign: asBool(raw.loadIsDesign, true),
    transverseKind: transverse,
    blockRows: asNum(raw.blockRows, "blockRows", errors) ?? 2,
    blockCols: asNum(raw.blockCols, "blockCols", errors) ?? 2,
    blockSpacing_m:
      raw.blockSpacing_m === null
        ? null
        : (asNum(raw.blockSpacing_m, "blockSpacing_m", errors) ?? null),
    blockEdge_m: asNum(raw.blockEdge_m, "blockEdge_m", errors) ?? 0.15,
    blockThickness_m:
      asNum(raw.blockThickness_m, "blockThickness_m", errors) ?? 0.6,
    blockEmbedment_m:
      asNum(raw.blockEmbedment_m, "blockEmbedment_m", errors) ?? 0.1,
    blockEfficiency:
      raw.blockEfficiency === null
        ? null
        : (asNum(raw.blockEfficiency, "blockEfficiency", errors) ?? null),
    footingShape: asStr(raw.footingShape, "rectangular"),
    footingAdmMode: asStr(raw.footingAdmMode, "sigma_adm"),
    footingSigmaAdm_kPa:
      asNum(raw.footingSigmaAdm_kPa, "footingSigmaAdm_kPa", errors) ?? 200,
    footingAspect: asNum(raw.footingAspect, "footingAspect", errors) ?? 1,
    footingThickness_m:
      raw.footingThickness_m === null
        ? null
        : (asNum(raw.footingThickness_m, "footingThickness_m", errors) ?? null),
    footingC_kPa: asNum(raw.footingC_kPa, "footingC_kPa", errors) ?? 0,
    footingPhi_deg: asNum(raw.footingPhi_deg, "footingPhi_deg", errors) ?? 30,
    footingGamma_kN_m3:
      asNum(raw.footingGamma_kN_m3, "footingGamma_kN_m3", errors) ?? 18,
    footingDf_m: asNum(raw.footingDf_m, "footingDf_m", errors) ?? 1,
    footingFs: asNum(raw.footingFs, "footingFs", errors) ?? 3,
    footingMx_kNm:
      raw.footingMx_kNm === null
        ? null
        : (asNum(raw.footingMx_kNm, "footingMx_kNm", errors) ?? null),
    footingMy_kNm:
      raw.footingMy_kNm === null
        ? null
        : (asNum(raw.footingMy_kNm, "footingMy_kNm", errors) ?? null),
    caissonShaftDia_m:
      asNum(raw.caissonShaftDia_m, "caissonShaftDia_m", errors) ?? 0.8,
    caissonBaseDia_m:
      raw.caissonBaseDia_m === null
        ? null
        : (asNum(raw.caissonBaseDia_m, "caissonBaseDia_m", errors) ?? null),
    caissonLength_m:
      asNum(raw.caissonLength_m, "caissonLength_m", errors) ?? 8,
    caissonAdmMode: asStr(raw.caissonAdmMode, "sigma_adm"),
    caissonSigmaAdm_kPa:
      asNum(raw.caissonSigmaAdm_kPa, "caissonSigmaAdm_kPa", errors) ?? 400,
    caissonC_kPa: asNum(raw.caissonC_kPa, "caissonC_kPa", errors) ?? 0,
    caissonPhi_deg: asNum(raw.caissonPhi_deg, "caissonPhi_deg", errors) ?? 30,
    caissonGamma_kN_m3:
      asNum(raw.caissonGamma_kN_m3, "caissonGamma_kN_m3", errors) ?? 18,
    caissonFsTip: asNum(raw.caissonFsTip, "caissonFsTip", errors) ?? 2,
    caissonUnitFriction_kPa:
      asNum(raw.caissonUnitFriction_kPa, "caissonUnitFriction_kPa", errors) ??
      40,
    caissonShaftFS: asNum(raw.caissonShaftFS, "caissonShaftFS", errors) ?? 2,
    caissonShaftMode: asStr(raw.caissonShaftMode, "user"),
    raftAspect: asNum(raw.raftAspect, "raftAspect", errors) ?? 1,
    raftAdmMode: asStr(raw.raftAdmMode, "sigma_adm"),
    raftSigmaAdm_kPa:
      asNum(raw.raftSigmaAdm_kPa, "raftSigmaAdm_kPa", errors) ?? 150,
    raftThickness_m:
      raw.raftThickness_m === null
        ? null
        : (asNum(raw.raftThickness_m, "raftThickness_m", errors) ?? null),
    raftC_kPa: asNum(raw.raftC_kPa, "raftC_kPa", errors) ?? 0,
    raftPhi_deg: asNum(raw.raftPhi_deg, "raftPhi_deg", errors) ?? 30,
    raftGamma_kN_m3:
      asNum(raw.raftGamma_kN_m3, "raftGamma_kN_m3", errors) ?? 18,
    raftDf_m: asNum(raw.raftDf_m, "raftDf_m", errors) ?? 1,
    raftFs: asNum(raw.raftFs, "raftFs", errors) ?? 3,
    raftMx_kNm:
      raw.raftMx_kNm === null
        ? null
        : (asNum(raw.raftMx_kNm, "raftMx_kNm", errors) ?? null),
    raftMy_kNm:
      raw.raftMy_kNm === null
        ? null
        : (asNum(raw.raftMy_kNm, "raftMy_kNm", errors) ?? null),
  };

  if (layers.length === 0 && errors.every((e) => !e.includes("layers"))) {
    errors.push("Nenhuma camada válida no snapshot.");
  }

  return {
    ok: errors.length === 0,
    data: errors.length === 0 ? data : null,
    errors,
    warnings,
  };
}
