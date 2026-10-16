/**
 * Tipos do motor de concepção de fundações (orquestra engines existentes).
 * Não contém fórmulas Aoki/Décourt — só decisões e score.
 */

export type ConceptionConfidence = "high" | "medium" | "low";

export interface SoilZone {
  from_m: number;
  to_m: number;
  meanNspt: number;
  minNspt: number;
  maxNspt: number;
  label: string;
  kind: "weak" | "intermediate" | "competent" | "very_competent";
}

export interface SoilProfileInterpretation {
  layerCount: number;
  maxDepth_m: number;
  meanNspt: number;
  zones: SoilZone[];
  /** Profundidade aproximada onde o perfil fica claramente mais competente. */
  resistantOnset_m: number | null;
  weakShallow: boolean;
  notes: string[];
  confidence: ConceptionConfidence;
}

export interface PileSolutionCandidate {
  pileTypeId: number;
  diameterCm: number;
  tipDepth_m: number;
  padmGoverning_kN: number;
  rows: number;
  cols: number;
  nPiles: number;
  /** η usada na verificação de grupo (Converse-Labarre se n>1). */
  efficiency: number;
  groupPadm_kN: number;
  utilization: number;
  totalLength_m: number;
  /** Proxy de volume de concreto das estacas (m³). */
  pileConcrete_m3: number;
  /** NSPT da camada onde a ponta se apoia (null se fora do trecho sondado). */
  tipNspt: number | null;
  /** True quando a ponta está dentro/abaixo da primeira camada competente. */
  bearsOnResistantLayer: boolean;
  /** Esbeltez L/D da estaca. */
  slenderness: number;
  ok: boolean;
  score: number;
  scoreBreakdown: {
    safety: number;
    efficiency: number;
    economy: number;
    execution: number;
    /** Apoio em camada resistente + esbeltez controlada (DEC-58). */
    bearing: number;
  };
  rationale: string;
}

export type ConceptionRole =
  | "recommended"
  | "economic"
  | "conservative"
  | "minimal_execution";

export interface ConceptionPileResult {
  profile: SoilProfileInterpretation;
  recommended: PileSolutionCandidate | null;
  alternatives: Array<{ role: ConceptionRole; candidate: PileSolutionCandidate }>;
  /** Melhores opções viáveis (para “Explorar mais opções”), já ranqueadas. */
  topOptions: PileSolutionCandidate[];
  evaluatedCount: number;
  confidence: ConceptionConfidence;
  summary: string;
  /** Se true, sapata parece melhor que estaca neste contexto. */
  preferShallow: boolean;
  shallowNote: string | null;
}
