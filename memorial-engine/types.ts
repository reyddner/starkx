import type { CalculationResult, CalculationMode, GoverningRule } from "../calculation-engine/types";
import type { StructuralDesignResult } from "../structural-engine/design";
import type { ElementTakeoff, ProjectTakeoffSummary } from "../structural-engine/takeoff";

export interface MemorialTable {
  title?: string;
  headers: string[];
  rows: string[][];
}

export interface MemorialGeneralData {
  concreteCap?: string;
  concreteCaps?: string;
  concretePile?: string;
  concretePiles?: string;
  steelGrades?: string[];
  steelGrade?: string;
  coverTop_cm?: number;
  coverBottom_cm?: number;
  coverLateral_cm?: number;
  coverFrontal_cm?: number;
  coverStarter_cm?: number;
  maxAggregateSize_mm?: number;
  leanConcreteThickness_cm?: number;
  allowableSoilStressFundamental_MPa?: number | null;
  allowableSoilStressAccidental_MPa?: number | null;
  standards?: string[];
}

export interface MemorialLoadRow {
  element?: string;
  ref?: string;
  combination?: string;
  N_kN?: number;
  axial_kN?: number;
  Mx_kNm?: number;
  momentX_kNm?: number;
  My_kNm?: number;
  momentY_kNm?: number;
  Vx_kN?: number;
  shearX_kN?: number;
  Vy_kN?: number;
  shearY_kN?: number;
  Mt_kNm?: number;
  torsion_kNm?: number;
}

export interface MemorialBoreholeLayer {
  depth_m: number;
  nspt: number;
  soilLabel: string;
}

export interface MemorialInput {
  generatedAtIso: string;
  project: {
    name: string;
    code: string;
    client: string;
    location: string;
  };
  pile?: {
    typeLabel: string;
    diameter_cm: number;
    /** Comprimento L a partir do topo (m). */
    tipDepth_m: number;
    /** Cota de ponta no perfil SPT (m). Default = tipDepth_m. */
    sptTipDepth_m?: number;
    /** Profundidade do topo abaixo da cota 0 (m). */
    pileTopDepth_m?: number;
    area_cm2?: number;
    perimeter_cm?: number;
  } | null;
  site: {
    waterLevel_m: number | null;
  };
  layers: MemorialBoreholeLayer[];
  designLoad_kN: number | null;
  methods?: {
    mode: CalculationMode;
    governingRule: GoverningRule;
    selectedMethod?: string | null;
    aokiFs: number;
    aokiPctTip: number;
    aokiPctShaft: number;
    decourtAlphaPct: number | null;
    decourtBetaPct: number | null;
    teixeiraFs: number;
    teixeiraPctTip: number;
    teixeiraPctShaft: number;
  } | null;
  geotechnical: CalculationResult | null;
  structural: StructuralDesignResult | null;
  /** Resultado do block-engine (opcional) — pilar ativo / legado */
  block?: {
    pileCount: number;
    spacing_m: number;
    rows: number;
    cols: number;
    edge_m: number;
    thickness_m: number;
    embedment_m?: number | null;
    width_m: number;
    length_m: number;
    groupPadm_kN: number | null;
    efficiency: number;
    efficiencyUserProvided: boolean;
    groupCapacityIndicative: boolean;
    capacityOk: boolean | null;
    warnings: string[];
    punchingMessage?: string | null;
    strutTieMessage?: string | null;
    rebarMessage?: string | null;
  } | null;
  /** Um bloco por pilar (multi-elemento). Quando presente, o memorial lista todos. */
  columnBlocks?: Array<{
    columnLabel: string;
    N_kN: number;
    Mx_kNm: number;
    My_kNm: number;
    pileCount: number;
    rows: number;
    cols: number;
    spacing_m: number;
    edge_m: number;
    thickness_m: number;
    width_m: number;
    length_m: number;
    groupPadm_kN: number | null;
    efficiency: number;
    efficiencyUserProvided: boolean;
    groupCapacityIndicative: boolean;
    capacityOk: boolean | null;
    warnings: string[];
  }> | null;
  /** Resultado do footing-engine (opcional — sapata isolada) */
  footing?: {
    shape: string;
    admMode: string;
    Nd_kN: number;
    B_m: number;
    L_m: number;
    area_m2: number;
    thickness_m: number;
    qadm_kPa: number;
    qult_kPa: number | null;
    sigmaAvg_kPa: number;
    sigmaMax_kPa: number;
    checksOk: boolean;
    warnings: string[];
    rebarMessage?: string | null;
  } | null;
  caisson?: {
    Nd_kN: number;
    shaftDiameter_m: number;
    baseDiameter_m: number;
    length_m: number;
    Rp_adm_kN: number;
    Rl_adm_kN: number;
    Padm_kN: number;
    verdict: string;
    shaftMode?: string;
    warnings: string[];
    rebarMessage?: string | null;
  } | null;
  raft?: {
    Nd_kN: number;
    B_m: number;
    L_m: number;
    area_m2: number;
    thickness_m: number;
    qadm_kPa: number;
    sigmaAvg_kPa: number;
    sigmaMax_kPa: number;
    checksOk: boolean;
    warnings: string[];
    rebarMessage?: string | null;
  } | null;
  softwareVersion: string;
  generalData?: MemorialGeneralData | null;
  loadsTable?: MemorialLoadRow[] | null;
  takeoffSummary?: ProjectTakeoffSummary | null;
  elementTakeoffs?: ElementTakeoff[] | null;
}

export interface MemorialSection {
  id: string;
  title: string;
  paragraphs: string[];
  table?: MemorialTable;
  tables?: MemorialTable[];
}

export interface MemorialDocument {
  title: string;
  subtitle: string;
  sections: MemorialSection[];
}
