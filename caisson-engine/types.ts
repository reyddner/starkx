export type CaissonAdmMode = "user" | "bearing";
/** user = fs informado; spt_aoki = α·K·N/F2 por metro (DEC-22) */
export type CaissonShaftMode = "user" | "spt_aoki";

export interface CaissonSoilParams {
  c_kPa: number;
  phi_deg: number;
  gamma_kN_m3: number;
  fsTip: number;
}

export interface CaissonSptLayerInput {
  depth_m: number;
  nspt: number;
  soilTypeId: number;
}

export interface CaissonDesignInput {
  Nk_kN: number;
  loadIsDesign?: boolean;
  gammaF?: number;
  shaftDiameter_m: number;
  /** Base alargada; default = shaft */
  baseDiameter_m?: number | null;
  length_m: number;
  admMode: CaissonAdmMode;
  sigmaAdm_kPa?: number | null;
  soil?: CaissonSoilParams | null;
  /** Default: user */
  shaftMode?: CaissonShaftMode;
  /** Atrito lateral unitário (kPa); modo user — DEC-25 nome claro (STX-CAI-001) */
  unitFriction_kPa?: number;
  /** Fator de segurança do fuste (adimensional) */
  shaftFS?: number;
  /** @deprecated use unitFriction_kPa */
  fsShaft_kPa?: number;
  /** @deprecated use shaftFS */
  fsShaft?: number;
  /** Obrigatório se shaftMode=spt_aoki — fatias 1 m */
  sptLayers?: CaissonSptLayerInput[] | null;
  /** Se informado, calcula As,mín orientativa (DEC-25) */
  fck_MPa?: number;
}

export interface CaissonCheck {
  id: string;
  title: string;
  status: "ok" | "warning" | "error";
  message: string;
  value?: number;
  limit?: number;
  unit?: string;
}

export interface CaissonTrace {
  stepId: string;
  title: string;
  formula: string;
  substitutions: Record<string, number | string>;
  result: number | string;
  unit: string;
  reference: string;
}

export interface CaissonDesignResult {
  Nd_kN: number;
  shaftDiameter_m: number;
  baseDiameter_m: number;
  length_m: number;
  Ap_m2: number;
  U_m: number;
  Rp_adm_kN: number;
  Rl_adm_kN: number;
  Padm_kN: number;
  qult_kPa: number | null;
  qadm_kPa: number;
  factors: { Nc: number; Nq: number; Ngamma: number } | null;
  shaftMode: CaissonShaftMode;
  avgFsShaft_kPa: number | null;
  verdict: "approved" | "not_ok";
  checks: CaissonCheck[];
  traces: CaissonTrace[];
  warnings: string[];
  rebar: {
    As_min_cm2: number;
    Larm_min_m: number;
    suggestBar_mm: number;
    suggestCount: number;
    message: string;
  } | null;
}
