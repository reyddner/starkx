/** Parâmetros NBR 6122:2019 Tabela 4 + defaults NBR 6118 — ver docs/METHODS.md */

export interface PileStructuralParams {
  fck_MPa: number;
  gammaC: number;
  rhoMin: number;
  /** null = armadura integral no comprimento da estaca */
  LarmMin_m: number | null;
  /** null = sempre armar pelo cálculo / mínimo */
  sigmaLimit_MPa: number | null;
  /** Pré-moldada: As,mín também ≥ 0,15·Nd/fyd (NBR 6118 17.3.5.3.1). */
  precast?: boolean;
  source: string;
}

const EXCAVATED_DRY: PileStructuralParams = {
  fck_MPa: 25,
  gammaC: 3.1,
  rhoMin: 0.004,
  LarmMin_m: 2.0,
  sigmaLimit_MPa: 5.0,
  source: "NBR 6122:2019 Tab.4 — Escavadas sem fluido (CAA I/II)",
};

/** Mapa pileTypeId STARKX → parâmetros Tabela 4 */
export const PILE_STRUCTURAL_PARAMS: Record<number, PileStructuralParams | "steel" | "timber" | "precast"> = {
  1: "precast",
  2: "precast",
  3: "timber",
  4: "steel",
  5: {
    fck_MPa: 20,
    gammaC: 2.5,
    rhoMin: 0.004,
    LarmMin_m: 2.0,
    sigmaLimit_MPa: 5.0,
    source: "NBR 6122:2019 Tab.4 — Strauss",
  },
  6: EXCAVATED_DRY,
  7: EXCAVATED_DRY,
  8: {
    ...EXCAVATED_DRY,
    source:
      "NBR 6122:2019 Tab.4 — Apiloada tratada como escavada sem fluido (DEC-19 / analogia executiva)",
  },
  9: {
    fck_MPa: 20,
    gammaC: 1.8,
    rhoMin: 0.004,
    LarmMin_m: null,
    sigmaLimit_MPa: null,
    source: "NBR 6122:2019 Tab.4 — Franki (armadura integral)",
  },
  10: {
    fck_MPa: 20,
    gammaC: 1.6,
    rhoMin: 0.004,
    LarmMin_m: null,
    sigmaLimit_MPa: null,
    source: "NBR 6122:2019 Tab.4 — Raiz (armadura integral)",
  },
  11: {
    fck_MPa: 30,
    gammaC: 2.7,
    rhoMin: 0.004,
    LarmMin_m: 4.0,
    sigmaLimit_MPa: 6.0,
    source: "NBR 6122:2019 Tab.4 — Hélice (CAA I/II)",
  },
};

export const PRECAST_PARAMS: PileStructuralParams = {
  fck_MPa: 35,
  gammaC: 1.4,
  rhoMin: 0.004,
  LarmMin_m: null,
  sigmaLimit_MPa: null,
  precast: true,
  source: "NBR 6118 — elemento comprimido pré-moldado (As,mín = 0,15·Nd/fyd ≥ 0,4 % Ac)",
};

export const GAMMA_S = 1.15;
export const GAMMA_F_DEFAULT = 1.4;
export const FYK_DEFAULT_MPA = 500;
/** NBR 6118 Tabela 7.2 — elemento em contato com o solo, CAA II. */
export const COVER_DEFAULT_MM = 40;
export const LONG_BAR_MM = [10, 12.5, 16, 20, 25] as const;
export const TRANS_BAR_MM = [5, 6.3, 8, 10] as const;
export const MIN_BARS_CIRCULAR = 6;

export function barArea_cm2(diameter_mm: number): number {
  const r_cm = diameter_mm / 20;
  return Math.PI * r_cm * r_cm;
}
