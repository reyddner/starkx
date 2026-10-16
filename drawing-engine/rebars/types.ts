import type { SteelGrade } from "@structural/takeoff";

export type RebarShapeKind =
  | "closed_rect"
  | "u_shape"
  | "l_shape"
  | "straight"
  | "circular_ring"
  | "diagonal";

export interface RebarShapeDefinition {
  posNumber: number;
  label?: string;
  name: string;
  shapeKind?: RebarShapeKind;
  kind?: RebarShapeKind; // alias de compatibilidade
  diameter_mm: number;
  steelGrade: SteelGrade;
  count: number;
  totalLength_cm?: number;
  totalLength_m?: number;
  unitLength_cm?: number;
  legs_cm: number[]; // Medidas de cada trecho em cm (para cotar na barra aberta)
  spacing_cm?: number;
}
