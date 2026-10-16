/**
 * Modo de cálculo. Há um só (fórmulas publicadas dos métodos); o tipo é mantido para
 * compatibilidade de projetos salvos, que são migrados para "engineering".
 */
export type CalculationMode = "engineering";
export type GoverningRule = "average" | "minimum" | "user_selected";
export type MethodId = "aoki_velloso" | "decourt_quaresma" | "teixeira";
export type Verdict = "approved" | "not_ok" | "not_applicable";

export interface SoilLayerInput {
  /**
   * Profundidade do SPT (m) a partir da cota 0 / superfície. Pode ser fracionária (DEC-57).
   */
  depth_m: number;
  nspt: number;
  soilTypeId: number;
  /**
   * Se true, Rl desta fatia = 0 (DEC-47).
   * Não altera Rp na ponta; não calcula atrito negativo (força ainda null).
   */
  excludeFromShaftFriction?: boolean;
}

export interface CalculationInput {
  pileTypeId: number;
  diameterCm: number;
  /**
   * Comprimento L da estaca a partir do topo (m).
   * Cota de ponta no SPT = pileTopDepth_m + tipDepth_m (DEC-57).
   */
  tipDepth_m: number;
  /**
   * Profundidade do topo da estaca abaixo da cota 0 (m). Default 0.
   * pile_cap: tipicamente t − embutimento (ex.: 0,90 m).
   */
  pileTopDepth_m?: number;
  areaCm2?: number;
  perimeterCm?: number;
  enlargedBaseVolumeLiters?: number;
  layers: SoilLayerInput[];
  waterLevel_m?: number | null;
  designLoad_kN?: number | null;
  mode?: CalculationMode;
  governingRule?: GoverningRule;
  selectedMethod?: MethodId;
  aoki?: { fs?: number; pctTip?: number; pctShaft?: number };
  decourt?: { alphaPct?: number; betaPct?: number };
  teixeira?: { fs?: number; pctTip?: number; pctShaft?: number };
  methods?: MethodId[];
}

export interface DepthMethodValues {
  Rp_kN: number;
  Rl_m_kN: number;
  Rl_acum_kN: number;
  Rult_kN: number;
  Padm_kN: number;
}

export interface MethodAtTip {
  methodId: MethodId;
  Rp_kN: number;
  Rl_acum_kN: number;
  Rult_kN: number;
  Padm_kN: number;
  extras?: Record<string, number | string>;
}

export interface CalculationTrace {
  stepId: string;
  methodId: MethodId | "spt" | "geometry" | "compare" | "pipeline";
  title: string;
  formula: string;
  substitutions: Record<string, number | string>;
  result: number | string;
  unit: string;
  reference: string;
}

/** Etapas para UI "Calculando..." (mesmo em execução síncrona) */
export interface CalculationStep {
  id: number;
  label: string;
  status: "pending" | "running" | "done";
}

export interface CalculationResult {
  mode: CalculationMode;
  geometry: { area_m2: number; perimeter_m: number; diameter_cm: number };
  steps: CalculationStep[];
  profile: Array<{
    depth_m: number;
    nspt: number;
    soilTypeId: number;
    spt: {
      P: number;
      Q: number;
      R: number;
      S: number;
      T: number;
      U: number;
    };
    aoki?: DepthMethodValues;
    decourt?: DepthMethodValues;
    teixeira?: DepthMethodValues;
    averagePadm_kN?: number;
  }>;
  atTip: {
    methods: MethodAtTip[];
    averagePadm_kN: number;
    minimumPadm_kN: number;
    governingPadm_kN: number;
    governingMethodId: MethodId | "average" | "minimum";
  };
  verdict: Verdict;
  traces: CalculationTrace[];
  warnings: string[];
  /** Carga estrutural usual (DEC-09); null se sem match tipo×Ø */
  nominalStructural: {
    nominal_kN: number;
    diameterCm: number;
    pileTypeId: number;
    source: string;
    governingPadm_kN: number;
    exceeded: boolean;
    message: string;
  } | null;
}
