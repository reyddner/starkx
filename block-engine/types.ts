import type { ElementTakeoff } from "@structural/takeoff";

export interface Vec2 {
  x_m: number;
  y_m: number;
}

export interface BlockPileInstance {
  id: string;
  label: string;
  position: Vec2;
}

export interface RectOutline {
  minX_m: number;
  maxX_m: number;
  minY_m: number;
  maxY_m: number;
  width_m: number;
  length_m: number;
}

export type BlockCheckSeverity = "ok" | "warning" | "error";

export interface BlockCheck {
  id: string;
  title: string;
  status: BlockCheckSeverity;
  message: string;
  value?: number;
  limit?: number;
  unit?: string;
}

export interface BlockTrace {
  stepId: string;
  title: string;
  formula: string;
  substitutions: Record<string, number | string>;
  result: number | string;
  unit: string;
  reference: string;
}

export interface BlockDesignInput {
  rows: number;
  cols: number;
  /** Espaçamento centro-centro (m). Se omitido, usa defaultSpacing. */
  spacing_m?: number | null;
  diameter_m: number;
  edge_m: number;
  thickness_m: number;
  /** Overrides opcionais */
  minSpacingFactor?: number;
  minSpacingAbsolute_m?: number;
  minEdge_m?: number;
  minThicknessFactorOnD?: number;
  minThicknessAbsolute_m?: number;
  /** Padm da estaca-tipo (kN), se já calculado */
  singlePadm_kN?: number | null;
  /** Carga vertical total do pilar (kN), característica salvo loadIsDesign. */
  groupLoad_kN?: number | null;
  /** Momentos do pilar na base do bloco (kN·m), mesma natureza de groupLoad_kN. */
  Mx_kNm?: number | null;
  My_kNm?: number | null;
  /** true se as cargas já são de cálculo. */
  loadIsDesign?: boolean;
  /** Dimensões do pilar (m) em x e y; default 0,30 m. */
  columnWidth_m?: number | null;
  columnDepth_m?: number | null;
  /** Tipo de estaca: define o espaçamento mínimo (2,5D pré-moldada/metálica; 3D moldada in loco). */
  pileTypeId?: number | null;
  /**
   * Eficiência de grupo η (0 < η ≤ 1 típico).
   * Se omitido: motor usa η=1 só para estimativa **indicativa** (DEC-17).
   * η é decisão do engenheiro (a UI sugere Converse-Labarre).
   */
  efficiency?: number | null;
  /** fck do bloco (MPa); default 25. */
  fck_MPa?: number;
  /** fyk dos tirantes (MPa); default 500. */
  fyk_MPa?: number;
}

export interface BlockDesignResult {
  pileCount: number;
  spacing_m: number;
  spacingMin_m: number;
  piles: BlockPileInstance[];
  cap: RectOutline & { thickness_m: number; area_m2: number };
  checks: BlockCheck[];
  groupPadm_kN: number | null;
  efficiency: number;
  /** true se o usuário informou η explicitamente */
  efficiencyUserProvided: boolean;
  /**
   * true quando Padm_grupo NÃO deve ser usado como veredito de projeto
   * (η não informado → soma simples η=1).
   */
  groupCapacityIndicative: boolean;
  /**
   * Comparação N × Padm_g — só preenchido se η foi informado pelo usuário.
   * null quando indicativo (DEC-17).
   */
  capacityOk: boolean | null;
  traces: BlockTrace[];
  warnings: string[];
  /** Biela e tirante (blocos de 2+ estacas); null sem carga. */
  strutTie: {
    rigid: boolean;
    d_m: number;
    thetaMin_deg: number;
    thetaMax_deg: number;
    Tx_kN: number;
    Ty_kN: number;
    AsX_cm2: number;
    AsY_cm2: number;
    sigmaColumn_MPa: number;
    sigmaPile_MPa: number;
    sigmaLimit_MPa: number;
    ok: boolean;
    message: string;
  } | null;
  /** Punção (NBR 6118 19.5) — só para bloco flexível; null nos demais casos. */
  punching: {
    tauSd_MPa: number;
    tauRd_MPa: number;
    ok: boolean;
    message: string;
  } | null;
  /** Armadura dos tirantes e malha complementar; null sem carga. */
  rebar: {
    tieX: { bar_mm: number; count: number; As_cm2: number };
    tieY: { bar_mm: number; count: number; As_cm2: number };
    suggestBar_mm: number;
    suggestSpacing_cm: number;
    message: string;
  } | null;
  /** Reações de serviço por estaca (kN), já com o peso próprio do bloco. */
  pileLoads_kN: number[];
  /** Quantitativo de materiais do bloco (concreto, concreto magro e aço com tabela de corte) */
  takeoff?: ElementTakeoff;
}
