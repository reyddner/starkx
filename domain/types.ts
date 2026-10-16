/**
 * Domínio paramétrico mínimo (fonte única do projeto).
 * Não contém fórmulas — apenas dados.
 * O motor recebe CalculationInput via adapter.
 */

export type FoundationKind =
  | "pile"
  | "pile_group"
  | "pile_cap"
  | "footing"
  | "raft"
  | "caisson";

export interface Project {
  id: string;
  name: string;
  code?: string;
  client?: string;
  location?: string;
  responsibleEngineer?: string;
  crea?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  boreholes: Borehole[];
  foundations: Foundation[];
}

export interface SoilLayer {
  topDepth_m: number;
  bottomDepth_m: number;
  nspt: number;
  soilTypeId: number;
  /** Descrição original da sondagem. */
  description?: string;
  /** Não considerar no atrito lateral. */
  excludeFromShaftFriction?: boolean;
  excludeReason?: string;
}

export interface Borehole {
  id: string;
  label: string;
  waterLevel_m: number | null;
  waterLevelDate?: string | null;
  waterLevelNotes?: string;
  groundElevation_m?: number | null;
  source: "manual" | "excel_import" | "pdf_future";
  layers: SoilLayer[];
}

export interface FoundationBase {
  id: string;
  kind: FoundationKind;
  label: string;
  boreholeId: string;
  designLoad_kN?: number | null;
}

/** Estaca isolada — produto atual STARKX ESTACAS */
export interface PileFoundation extends FoundationBase {
  kind: "pile";
  pileTypeId: number;
  diameter_m: number;
  length_m: number;
  tipDepth_m: number;
  /** Posição no terreno (preparação blocos) — metros */
  position: { x_m: number; y_m: number; z_m?: number };
  groupId?: string | null;
  area_m2?: number | null;
  perimeter_m?: number | null;
  enlargedBaseVolumeLiters?: number | null;
  reinforcementId?: string | null;
}

/** Grupo de estacas (Fase 7) */
export interface PileGroupFoundation extends FoundationBase {
  kind: "pile_group";
  pileIds: string[];
  rows: number;
  cols: number;
  spacing_m: number;
}

/** Bloco sobre estacas (Fase 7) */
export interface PileCapFoundation extends FoundationBase {
  kind: "pile_cap";
  pileGroupId: string;
  edge_m: number;
  thickness_m: number;
  /** Contorno retangular proposto (m) */
  width_m?: number;
  length_m?: number;
}

export interface FootingFoundation extends FoundationBase {
  kind: "footing";
  width_m: number;
  length_m: number;
  height_m: number;
}

export interface RaftFoundation extends FoundationBase {
  kind: "raft";
  outline: Array<{ x_m: number; y_m: number }>;
  thickness_m: number;
}

export interface CaissonFoundation extends FoundationBase {
  kind: "caisson";
  diameter_m: number;
  length_m: number;
}

export type Foundation =
  | PileFoundation
  | PileGroupFoundation
  | PileCapFoundation
  | FootingFoundation
  | RaftFoundation
  | CaissonFoundation;

export function isPileFoundation(f: Foundation): f is PileFoundation {
  return f.kind === "pile";
}

export function isPileCapFoundation(f: Foundation): f is PileCapFoundation {
  return f.kind === "pile_cap";
}

export function isPileGroupFoundation(f: Foundation): f is PileGroupFoundation {
  return f.kind === "pile_group";
}

export function isFootingFoundation(f: Foundation): f is FootingFoundation {
  return f.kind === "footing";
}

export function isRaftFoundation(f: Foundation): f is RaftFoundation {
  return f.kind === "raft";
}

export function isCaissonFoundation(f: Foundation): f is CaissonFoundation {
  return f.kind === "caisson";
}

/** UI oficial usa store flat; estes guards servem ao modelo domain tipado (DEC-33). */
export function isDeepFoundation(
  f: Foundation,
): f is PileFoundation | PileGroupFoundation | PileCapFoundation | CaissonFoundation {
  return (
    isPileFoundation(f) ||
    isPileGroupFoundation(f) ||
    isPileCapFoundation(f) ||
    isCaissonFoundation(f)
  );
}
