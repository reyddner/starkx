/**
 * Tipos para quantitativos de materiais (Aço CA-50/CA-60 e Concreto).
 * Medição e tabela de corte/dobra no padrão usual de projeto executivo (NBR 6118).
 */

export type SteelGrade = "CA-50" | "CA-60";

export interface RebarItem {
  /** Nome identificador da armadura (ex: "Armadura vertical", "Armadura horizontal", "Estribos XZ"). */
  name: string;
  steelGrade: SteelGrade;
  diameter_mm: number;
  count: number;
  /** Comprimento unitário da barra cortada e dobrada (m). */
  unitLength_m: number;
  /** Comprimento total da posição = count * unitLength_m (m). */
  totalLength_m: number;
  /** Massa linear nominal (kg/m). */
  weightKgPerMeter: number;
  /** Massa total líquida da posição = totalLength_m * weightKgPerMeter (kg). */
  totalWeight_kg: number;
}

export interface ElementTakeoff {
  elementRef: string;
  elementKind: "pile" | "pile_cap" | "footing" | "caisson" | "raft";
  concreteGrade: string;
  /** Volume geométrico de concreto estrutural (m³). */
  concreteVolume_m3: number;
  /** Volume de concreto de limpeza / magro (m³). */
  leanConcreteVolume_m3: number;
  /** Lista de posições de aço do elemento. */
  items: RebarItem[];
  /** Massa total de aço sem perdas (kg). */
  totalSteelWeight_kg: number;
  /** Massa total de aço com perdas (kg). */
  totalSteelWithLosses_kg: number;
  /** Percentual de perdas aplicado (default: 10.00%). */
  lossPercentage: number;
  /** Resumo por diâmetro para este elemento. */
  byDiameter: Record<number, {
    steelGrade: SteelGrade;
    totalLength_m: number;
    weight_kg: number;
    weightWithLoss_kg: number;
  }>;
}

export interface ProjectTakeoffSummary {
  elements: ElementTakeoff[];
  lossPercentage: number;
  /** Consumo total de CA-50 por diâmetro em kg (com perdas incluídas). */
  ca50ByDiameter_kg: Record<number, number>;
  /** Consumo total de CA-60 por diâmetro em kg (com perdas incluídas). */
  ca60ByDiameter_kg: Record<number, number>;
  /** Total geral CA-50 em kg (com perdas). */
  totalCA50_kg: number;
  /** Total geral CA-60 em kg (com perdas). */
  totalCA60_kg: number;
  /** Total geral de aço em kg (com perdas). */
  totalSteel_kg: number;
  /** Volume total de concreto estrutural por classe (ex: C20, C30) em m³. */
  concreteByGrade_m3: Record<string, number>;
  /** Volume total de concreto magro/limpeza em m³. */
  totalLeanConcrete_m3: number;
}
