export type FootingShape = "square" | "rectangular";
export type FootingAdmMode = "user" | "bearing";

export interface FootingSoilParams {
  c_kPa: number;
  phi_deg: number;
  gamma_kN_m3: number;
  embedment_m: number;
  fsBearing: number;
}

export interface FootingDesignInput {
  Nk_kN: number;
  loadIsDesign?: boolean;
  gammaF?: number;
  Mx_kNm?: number;
  My_kNm?: number;
  shape: FootingShape;
  /** L/B ≥ 1; ignorado se square */
  aspectRatio?: number;
  admMode: FootingAdmMode;
  /** Obrigatório se admMode=user */
  sigmaAdm_kPa?: number | null;
  soil?: FootingSoilParams | null;
  thickness_m?: number | null;
  /** Peso específico do concreto para peso próprio (kN/m³); 0 = ignorar */
  gammaConcrete_kN_m3?: number;
  /** Se informado, faz o dimensionamento estrutural (flexão, biela, punção). */
  fck_MPa?: number;
  /** fyk da armadura (MPa); default 500. */
  fyk_MPa?: number;
  /** Dimensões do pilar (m) na direção de B e de L; default 0,30 m. */
  columnWidth_m?: number | null;
  columnDepth_m?: number | null;
  /** "raft": usa espessura própria e não aplica o modelo estrutural de sapata. */
  elementKind?: "footing" | "raft";
}

export interface FootingCheck {
  id: string;
  title: string;
  status: "ok" | "warning" | "error";
  message: string;
  value?: number;
  limit?: number;
  unit?: string;
}

export interface FootingTrace {
  stepId: string;
  title: string;
  formula: string;
  substitutions: Record<string, number | string>;
  result: number | string;
  unit: string;
  reference: string;
}

export interface FootingDesignResult {
  /** Carga vertical de serviço usada na geotecnia (kN). */
  Nk_kN: number;
  /** Carga vertical de cálculo usada no estrutural (kN). */
  Nd_kN: number;
  B_m: number;
  L_m: number;
  area_m2: number;
  thickness_m: number;
  thicknessSuggested_m: number;
  qult_kPa: number | null;
  qadm_kPa: number;
  sigmaAvg_kPa: number;
  sigmaMax_kPa: number;
  ex_m: number;
  ey_m: number;
  factors: { Nc: number; Nq: number; Ngamma: number } | null;
  checks: FootingCheck[];
  traces: FootingTrace[];
  warnings: string[];
  /** true se h ≥ (B − bp)/3 nas duas direções (NBR 6118 22.6.1). */
  rigid: boolean;
  rebar: {
    As_min_cm2_per_m: number;
    /** Armadura paralela a B (cm²/m), pelo momento na seção S1 (CEB-70). */
    AsB_cm2_per_m: number;
    /** Armadura paralela a L (cm²/m). */
    AsL_cm2_per_m: number;
    suggestBar_mm: number;
    suggestSpacing_cm: number;
    message: string;
  } | null;
}
