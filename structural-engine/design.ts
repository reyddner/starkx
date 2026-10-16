import {
  barArea_cm2,
  COVER_DEFAULT_MM,
  FYK_DEFAULT_MPA,
  GAMMA_F_DEFAULT,
  GAMMA_S,
  LONG_BAR_MM,
  MIN_BARS_CIRCULAR,
  PILE_STRUCTURAL_PARAMS,
  PRECAST_PARAMS,
  TRANS_BAR_MM,
  type PileStructuralParams,
} from "./catalog";
import {
  designCircularShear,
  maxAxialResistance_kN,
  minimumFirstOrderMoment_kNm,
  momentResistance_kNm,
  type CircularRcSection,
} from "./circularSection";
import { computePileTakeoff } from "./takeoff/pileTakeoff";
import type { ElementTakeoff } from "./takeoff/types";

export type StructuralStatus =
  | "ok"
  | "ok_min_connection"
  | "not_ok"
  | "not_applicable";

export interface StructuralDesignInput {
  pileTypeId: number;
  diameter_m: number;
  tipDepth_m: number;
  /** Carga característica (kN). Se loadIsDesign=true, trata como Nd. */
  Nk_kN: number;
  loadIsDesign?: boolean;
  fck_MPa?: number;
  fyk_MPa?: number;
  cover_mm?: number;
  transverseKind?: "stirrup" | "spiral";
  /**
   * Momento resultante característico (kN·m). Se loadIsDesign, trata como Msd.
   * Omitido/0 (e sem cortante) → compressão centrada.
   */
  Mk_kNm?: number;
  /** Cortante resultante característico (kN). Se loadIsDesign, trata como Vsd. */
  Vk_kN?: number;
}

export interface ReinforcementDetail {
  longitudinal: { diameter_mm: number; count: number; As_cm2: number };
  transverse: {
    kind: "stirrup" | "spiral";
    diameter_mm: number;
    spacing_m: number;
  };
  cover_mm: number;
  cageLength_m: number;
  detailText: string;
}

export interface StructuralNmSummary {
  mode: "centered" | "nm";
  /** Momento informado, de cálculo (kN·m). */
  Msd_kNm: number;
  /** Momento de dimensionamento = max(Msd, M1d,mín) (kN·m). */
  Md_kNm: number;
  Vsd_kN: number;
  /** Excentricidade de dimensionamento Md/Nd (m). */
  e_m: number;
  /** Momento resistente da seção detalhada para Nd (kN·m). */
  MRd_kNm: number;
  /** Resistência da biela comprimida (kN). */
  VRd2_kN: number;
  /** Parcela do concreto Vc (kN). */
  Vc_kN: number;
  /** Asw/s necessária (cm²/m). */
  AswPerS_cm2_m: number;
  bendingOk: boolean;
  shearOk: boolean;
}

export interface StructuralDesignResult {
  status: StructuralStatus;
  message: string;
  params: PileStructuralParams | null;
  Ac_m2: number;
  fcd_MPa: number;
  fyd_MPa: number;
  Nd_kN: number;
  sigma_MPa: number;
  As_min_cm2: number;
  As_calc_cm2: number;
  As_nec_cm2: number;
  As_max_cm2: number;
  As_ef_cm2: number;
  Nrd_kN: number;
  detail: ReinforcementDetail | null;
  nm: StructuralNmSummary | null;
  takeoff: ElementTakeoff | null;
  traces: Array<{
    title: string;
    formula: string;
    substitutions: Record<string, number | string>;
    result: number | string;
    unit: string;
    reference: string;
  }>;
  warnings: string[];
}

/** Tensão no aço comprimido a εc = 2‰ (compressão centrada, NBR 6118 17.2.2). */
const ES_MPA = 210000;
const EPS_CENTERED = 0.002;

function resolveParams(pileTypeId: number): PileStructuralParams | "steel" | "timber" {
  const p = PILE_STRUCTURAL_PARAMS[pileTypeId];
  if (p == null) throw new Error(`Tipo de estaca estrutural desconhecido: ${pileTypeId}`);
  if (p === "steel" || p === "timber") return p;
  if (p === "precast") return PRECAST_PARAMS;
  return p;
}

/** Espaçamento máximo dos estribos (NBR 6118 18.4.3): min(20 cm, D, 12φℓ CA-50 / 24φℓ CA-25). */
function maxStirrupSpacing_m(longDia_mm: number, diameter_m: number, fyk_MPa: number): number {
  const k = fyk_MPa >= 500 ? 12 : 24;
  return Math.min(0.2, diameter_m, (k * longDia_mm) / 1000);
}

function transverseDiameter_mm(longDia_mm: number): number {
  const minDia = Math.max(5, longDia_mm / 4);
  return TRANS_BAR_MM.find((d) => d + 1e-9 >= minDia) ?? 10;
}

/** Quantas barras cabem no perímetro com folga livre ≥ max(20 mm, φ). */
function maxBarsOnCircle(diameter_m: number, cover_m: number, transDia_mm: number, longDia_mm: number): number {
  const rs = diameter_m / 2 - cover_m - transDia_mm / 1000 - longDia_mm / 2000;
  if (rs <= 0) return 0;
  const pitch = Math.max(0.02, longDia_mm / 1000) + longDia_mm / 1000;
  return Math.floor((2 * Math.PI * rs) / pitch);
}

function sectionFor(
  D: number,
  cover_m: number,
  longDia_mm: number,
  count: number,
  fcd: number,
  fyd: number,
): CircularRcSection {
  const transDia = transverseDiameter_mm(longDia_mm);
  return {
    diameter_m: D,
    barCenterCover_m: cover_m + transDia / 1000 + longDia_mm / 2000,
    barCount: count,
    barDiameter_mm: longDia_mm,
    fcd_MPa: fcd,
    fyd_MPa: fyd,
  };
}

/**
 * Dimensionamento estrutural de estaca de concreto (seção circular).
 * Parâmetros de concreto por tipo de estaca: NBR 6122:2019 Tabela 4.
 * Compressão centrada: Nrd = 0,85·fcd·Ac + As·σs(2‰).
 * Com M e/ou V: flexo-compressão por integração da seção e cortante pelo Modelo I (NBR 6118).
 */
export function designPileReinforcement(input: StructuralDesignInput): StructuralDesignResult {
  const traces: StructuralDesignResult["traces"] = [];
  const warnings: string[] = [];
  const D = input.diameter_m;
  const Ac = (Math.PI * D * D) / 4;
  const resolved = resolveParams(input.pileTypeId);

  if (resolved === "steel" || resolved === "timber") {
    return {
      status: "not_applicable",
      message:
        resolved === "steel"
          ? "Estaca metálica — armadura de concreto não se aplica (verificar o perfil pela NBR 8800)."
          : "Estaca de madeira — armadura de concreto não se aplica (verificar a peça pela NBR 7190).",
      params: null,
      Ac_m2: Ac,
      fcd_MPa: 0,
      fyd_MPa: 0,
      Nd_kN: input.Nk_kN,
      sigma_MPa: 0,
      As_min_cm2: 0,
      As_calc_cm2: 0,
      As_nec_cm2: 0,
      As_max_cm2: 0,
      As_ef_cm2: 0,
      Nrd_kN: 0,
      detail: null,
      nm: null,
      takeoff: null,
      traces: [],
      warnings: [],
    };
  }

  const base = resolved;
  const fck = input.fck_MPa ?? base.fck_MPa;
  const fyk = input.fyk_MPa ?? FYK_DEFAULT_MPA;
  const gammaC = base.gammaC;
  const fcd = fck / gammaC;
  const fyd = fyk / GAMMA_S;
  const sigmaS2 = Math.min(fyd, ES_MPA * EPS_CENTERED);
  const gammaF = input.loadIsDesign ? 1 : GAMMA_F_DEFAULT;
  const Nd = gammaF * input.Nk_kN;
  const Msd = gammaF * Math.max(0, input.Mk_kNm ?? 0);
  const Vsd = gammaF * Math.max(0, input.Vk_kN ?? 0);
  const useNm = Msd > 1e-9 || Vsd > 1e-9;
  const sigma = Nd / (Ac * 1000);
  const As_max_cm2 = 0.04 * Ac * 1e4;
  const cover_mm = input.cover_mm ?? COVER_DEFAULT_MM;
  const cover_m = cover_mm / 1000;
  // NBR 6118 17.3.5.3.1: As,mín = 0,15·Nd/fyd ≥ ρmín·Ac (ρmín da Tabela 4 da NBR 6122 nas moldadas).
  const As_min_cm2 = Math.max(base.rhoMin * Ac * 1e4, base.precast ? ((0.15 * Nd) / (fyd * 1000)) * 1e4 : 0);

  traces.push({
    title: "Área da seção",
    formula: "Ac = π·D²/4",
    substitutions: { D_m: D, Ac_m2: Ac },
    result: Ac,
    unit: "m²",
    reference: "Geometria",
  });
  traces.push({
    title: "Resistências de cálculo",
    formula: "fcd = fck/γc ; fyd = fyk/γs ; σs(2‰) = min(fyd, Es·0,002)",
    substitutions: { fck, gammaC, fcd, fyk, gammaS: GAMMA_S, fyd, sigmaS2 },
    result: fcd,
    unit: "MPa",
    reference: base.source,
  });
  traces.push({
    title: "Solicitação de cálculo",
    formula: input.loadIsDesign ? "Nd, Msd, Vsd informados" : "Sd = γf · Sk",
    substitutions: { Nk_kN: input.Nk_kN, gammaF, Nd_kN: Nd, Msd_kNm: Msd, Vsd_kN: Vsd },
    result: Nd,
    unit: "kN",
    reference: "NBR 6118 / NBR 8681 (γf = 1,4)",
  });

  // Compressão centrada: Nd ≤ 0,85·fcd·Ac + As·σs(2‰)
  const Nrd_conc = 0.85 * fcd * Ac * 1000;
  const As_calc_cm2 = Nd > Nrd_conc ? ((Nd - Nrd_conc) / (sigmaS2 * 1000)) * 1e4 : 0;

  let status: StructuralStatus = "ok";
  let message = "Detalhamento conforme As,nec (máximo entre cálculo e As,mín).";

  const centeredMinOnly =
    !useNm && base.sigmaLimit_MPa != null && sigma <= base.sigmaLimit_MPa + 1e-9;
  if (centeredMinOnly) {
    status = "ok_min_connection";
    message =
      "Tensão ≤ σlim (NBR 6122 Tab. 4): fuste pode ser não armado; adotada armadura mínima de ligação.";
    warnings.push(
      `σ = ${sigma.toFixed(2)} MPa ≤ σlim = ${base.sigmaLimit_MPa} MPa — armadura de ligação (As,mín).`,
    );
  }

  // Flexo-compressão: Md = max(Msd, M1d,mín)
  const M1dMin = minimumFirstOrderMoment_kNm(Nd, D);
  const Md = Math.max(Msd, M1dMin);

  type Choice = { diameter_mm: number; count: number; As_cm2: number; MRd: number | null };
  const candidates: Choice[] = [];
  for (const dia of LONG_BAR_MM) {
    const transDia = transverseDiameter_mm(dia);
    const nMax = maxBarsOnCircle(D, cover_m, transDia, dia);
    for (let n = MIN_BARS_CIRCULAR; n <= nMax; n++) {
      const As = n * barArea_cm2(dia);
      if (As + 1e-9 < Math.max(As_min_cm2, useNm ? 0 : As_calc_cm2)) continue;
      if (As > As_max_cm2 + 1e-9) break;
      let MRd: number | null = null;
      if (useNm) {
        MRd = momentResistance_kNm(sectionFor(D, cover_m, dia, n, fcd, fyd), Nd);
        if (MRd == null || MRd + 1e-6 < Md) continue;
      }
      candidates.push({ diameter_mm: dia, count: n, As_cm2: As, MRd });
      break; // menor n que atende para este φ
    }
  }
  candidates.sort((a, b) => a.As_cm2 - b.As_cm2 || a.count - b.count);
  const long = candidates[0];

  const As_nec_cm2 = useNm
    ? long?.As_cm2 ?? As_max_cm2
    : Math.max(As_calc_cm2, As_min_cm2);

  traces.push({
    title: "Área de aço",
    formula: useNm
      ? "menor n·φ com Md ≤ MRd(Nd) e As ≥ As,mín; Md = max(Msd, Nd·(0,015+0,03·D))"
      : "As,nec = max((Nd − 0,85·fcd·Ac)/σs(2‰), As,mín)",
    substitutions: {
      As_calc_cm2,
      As_min_cm2,
      As_nec_cm2,
      sigma_MPa: sigma,
      sigmaLimit: base.sigmaLimit_MPa ?? "—",
      Md_kNm: useNm ? Md : 0,
      mode: useNm ? "nm" : "centered",
    },
    result: As_nec_cm2,
    unit: "cm²",
    reference: useNm ? "NBR 6118 17.2 / 11.3.3.4.3" : "NBR 6118 17.2.2",
  });

  if (!long) {
    return {
      status: "not_ok",
      message: useNm
        ? "Nenhuma armadura até As,máx (4 % Ac) resiste a Nd e Md. Aumente a seção ou reduza a solicitação."
        : "As necessária supera As,máx (4 % Ac). Aumente a seção ou reduza a carga.",
      params: base,
      Ac_m2: Ac,
      fcd_MPa: fcd,
      fyd_MPa: fyd,
      Nd_kN: Nd,
      sigma_MPa: sigma,
      As_min_cm2,
      As_calc_cm2,
      As_nec_cm2,
      As_max_cm2,
      As_ef_cm2: 0,
      Nrd_kN: Nrd_conc,
      detail: null,
      nm: null,
      takeoff: null,
      traces,
      warnings,
    };
  }

  const transDia = transverseDiameter_mm(long.diameter_mm);
  let spacing = maxStirrupSpacing_m(long.diameter_mm, D, fyk);
  let nmSummary: StructuralNmSummary;

  if (useNm) {
    const shear = designCircularShear({
      diameter_m: D,
      cover_m,
      stirrupDiameter_mm: transDia,
      longDiameter_mm: long.diameter_mm,
      fck_MPa: fck,
      gammaC,
      fywd_MPa: Math.min(fyd, 435),
      Vsd_kN: Vsd,
    });
    spacing = Math.min(spacing, shear.maxSpacing_m);
    const MRd = long.MRd ?? 0;
    nmSummary = {
      mode: "nm",
      Msd_kNm: Msd,
      Md_kNm: Md,
      Vsd_kN: Vsd,
      e_m: Nd > 1e-9 ? Md / Nd : 0,
      MRd_kNm: MRd,
      VRd2_kN: shear.VRd2_kN,
      Vc_kN: shear.Vc_kN,
      AswPerS_cm2_m: shear.AswPerS_cm2_m,
      bendingOk: Md <= MRd + 1e-6,
      shearOk: shear.crushingOk,
    };
    traces.push({
      title: "Flexo-compressão",
      formula: "MRd(Nd) por integração da seção (parábola-retângulo 0,85·fcd; aço elastoplástico)",
      substitutions: { Nd_kN: Nd, Msd_kNm: Msd, M1d_min_kNm: M1dMin, Md_kNm: Md, MRd_kNm: MRd },
      result: MRd,
      unit: "kN·m",
      reference: "NBR 6118 17.2",
    });
    traces.push({
      title: "Cortante (Modelo I)",
      formula: "VRd2 = 0,27·αv2·fcd·bw·d ; Vc = 0,6·fctd·bw·d ; Asw/s = (Vsd−Vc)/(0,9·d·fywd); bw = 0,886·D",
      substitutions: {
        Vsd_kN: Vsd,
        VRd2_kN: shear.VRd2_kN,
        Vc_kN: shear.Vc_kN,
        AswPerS_cm2_m: shear.AswPerS_cm2_m,
        s_m: spacing,
      },
      result: shear.AswPerS_cm2_m,
      unit: "cm²/m",
      reference: "NBR 6118 17.4.2.2",
    });
    if (!shear.crushingOk) {
      status = "not_ok";
      message = `Vsd = ${Vsd.toFixed(1)} kN > VRd2 = ${shear.VRd2_kN.toFixed(1)} kN: esmagamento da biela. Aumente a seção.`;
    } else if (spacing < 0.05) {
      status = "not_ok";
      message = "Estribos necessários a menos de 5 cm: aumente φ do estribo ou a seção.";
    } else {
      message = "Flexo-compressão e cortante verificados pela NBR 6118 (sem efeitos de 2ª ordem).";
    }
  } else {
    nmSummary = {
      mode: "centered",
      Msd_kNm: 0,
      Md_kNm: 0,
      Vsd_kN: 0,
      e_m: 0,
      MRd_kNm: 0,
      VRd2_kN: 0,
      Vc_kN: 0,
      AswPerS_cm2_m: 0,
      bendingOk: true,
      shearOk: true,
    };
  }

  const trans = {
    kind: input.transverseKind ?? ("spiral" as const),
    diameter_mm: transDia,
    spacing_m: Math.max(0.05, Math.floor(spacing * 100 + 1e-9) / 100),
  };

  let cageLength_m: number;
  if (base.LarmMin_m == null) {
    cageLength_m = input.tipDepth_m;
  } else if (useNm) {
    cageLength_m = Math.max(base.LarmMin_m, 0.5 * input.tipDepth_m);
    warnings.push(
      `Com momento/cortante: Lgaiola sugerida ≥ max(Larm,mín, 0,5·L) = ${cageLength_m.toFixed(2)} m — confirme o comprimento pela distribuição de esforços ao longo do fuste.`,
    );
  } else {
    cageLength_m = Math.min(input.tipDepth_m, base.LarmMin_m);
    if (input.tipDepth_m < base.LarmMin_m) {
      cageLength_m = base.LarmMin_m;
      warnings.push(
        `Comprimento da estaca (${input.tipDepth_m} m) < Larm,mín (${base.LarmMin_m} m). Adotar Larm,mín.`,
      );
    }
  }
  if (cageLength_m > input.tipDepth_m) cageLength_m = input.tipDepth_m;

  const Nrd = useNm
    ? maxAxialResistance_kN(sectionFor(D, cover_m, long.diameter_mm, long.count, fcd, fyd))
    : Nrd_conc + sigmaS2 * (long.As_cm2 * 1e-4) * 1000;
  if (Nd > Nrd + 1e-6) {
    status = "not_ok";
    message = "Nd supera Nrd da seção detalhada.";
  }

  const kindLabel = trans.kind === "spiral" ? "Espiral" : "Estribo";
  const detailText = `${long.count} φ ${long.diameter_mm} mm · ${kindLabel} φ ${trans.diameter_mm} mm c/${(trans.spacing_m * 100).toFixed(0)} cm · c=${cover_mm} mm · Lgaiola=${cageLength_m.toFixed(2)} m`;

  traces.push({
    title: "Detalhamento",
    formula: "n ≥ 6 ; φt ≥ max(5 mm, φℓ/4) ; s ≤ min(20 cm, D, 12φℓ) e ≤ s do cortante",
    substitutions: {
      n: long.count,
      phi_mm: long.diameter_mm,
      As_ef_cm2: long.As_cm2,
      st_phi: trans.diameter_mm,
      s_m: trans.spacing_m,
    },
    result: detailText,
    unit: "—",
    reference: "NBR 6118 18.4",
  });

  const takeoff = computePileTakeoff({
    elementRef: `ESTACA ${Math.round(D * 100)}cm`,
    diameter_m: D,
    length_m: input.tipDepth_m,
    longitudinalCount: long.count,
    longitudinalDia_mm: long.diameter_mm,
    transverseDia_mm: trans.diameter_mm,
    transverseSpacing_m: trans.spacing_m,
    transverseKind: trans.kind,
    cover_m,
    cageLength_m,
    concreteGrade: `C${Math.round(fck)}`,
  });

  return {
    status,
    message,
    params: base,
    Ac_m2: Ac,
    fcd_MPa: fcd,
    fyd_MPa: fyd,
    Nd_kN: Nd,
    sigma_MPa: sigma,
    As_min_cm2,
    As_calc_cm2,
    As_nec_cm2,
    As_max_cm2,
    As_ef_cm2: long.As_cm2,
    Nrd_kN: Nrd,
    detail: {
      longitudinal: { diameter_mm: long.diameter_mm, count: long.count, As_cm2: long.As_cm2 },
      transverse: trans,
      cover_mm,
      cageLength_m,
      detailText,
    },
    nm: nmSummary,
    takeoff,
    traces,
    warnings,
  };
}
