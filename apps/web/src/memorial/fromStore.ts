import { getSoilType, getPileType } from "@engine/catalogs";
import { resolvePileDatum } from "@domain/pileDatum";
import {
  buildMemorialDocument,
  memorialToHtml,
  memorialToMarkdown,
  type MemorialInput,
} from "@memorial/index";
import type { CalculationResult, CalculationMode, GoverningRule } from "@engine/types";
import type { StructuralDesignResult } from "@structural/design";
import type { BlockDesignResult } from "@block/index";
import type { FootingDesignResult } from "@footing/index";
import type { CaissonDesignResult } from "@caisson/index";
import type { RaftDesignResult } from "@raft/index";
import {
  aggregateProjectTakeoff,
  computeBlockTakeoff,
  type ElementTakeoff,
} from "@structural/takeoff";
import {
  buildProjectOutputs,
  type ProjectOutputsSource,
} from "../store/buildProjectOutputs";
import type { ColumnRecord } from "../store/columns";

/** Snapshot mínimo do store da UI para o memorial (sem dependência circular). */
export interface MemorialStoreSnapshot {
  projectName: string;
  projectCode: string;
  client: string;
  location: string;
  responsibleEngineer?: string;
  engineerCrea?: string;
  companyLogoBase64?: string | null;
  pileTypeId: number;
  diameterCm: number;
  tipDepth_m: number;
  blockThickness_m?: number;
  blockEmbedment_m?: number;
  pileTopElevation_m?: number | null;
  areaCm2: string;
  perimeterCm: string;
  waterLevel_m: number | null;
  layers: Array<{ depth_m: number; nspt: number; soilTypeId: number }>;
  designLoad_kN: number | null;
  mode: CalculationMode;
  governingRule: GoverningRule;
  selectedMethod?: string | null;
  aokiFs: number;
  aokiPctTip: number;
  aokiPctShaft: number;
  decourtAlphaPct: number | null;
  decourtBetaPct: number | null;
  teixeiraFs: number;
  teixeiraPctTip: number;
  teixeiraPctShaft: number;
  blockRows: number;
  blockCols: number;
  blockEdge_m: number;
  blockSpacing_m?: number | null;
  blockEfficiency?: number | null;
  result: CalculationResult | null;
  structural: StructuralDesignResult | null;
  blockResult: BlockDesignResult | null;
  footingResult: FootingDesignResult | null;
  caissonResult: CaissonDesignResult | null;
  raftResult: RaftDesignResult | null;
  footingShape: string;
  footingAdmMode: string;
  foundationKind: "pile" | "pile_cap" | "footing" | "caisson" | "raft";
  fck_MPa?: number | null;
  fyk_MPa?: number;
  cover_mm?: number;
  columns?: ColumnRecord[];
  activeColumnId?: string;
  columnLoad?: {
    columnLabel?: string;
    N_kN?: number | null;
    Mx_kNm?: number | null;
    My_kNm?: number | null;
    Qx_kN?: number | null;
    Qy_kN?: number | null;
  };
}

function toOutputsSource(s: MemorialStoreSnapshot): ProjectOutputsSource {
  const columns = s.columns ?? [];
  return {
    projectName: s.projectName,
    projectCode: s.projectCode,
    client: s.client,
    location: s.location,
    responsibleEngineer: s.responsibleEngineer ?? "",
    engineerCrea: s.engineerCrea ?? "",
    companyLogoBase64: s.companyLogoBase64 ?? null,
    foundationKind: s.foundationKind,
    columns,
    activeColumnId: s.activeColumnId ?? columns[0]?.id ?? "active",
    diameterCm: s.diameterCm,
    tipDepth_m: s.tipDepth_m,
    blockRows: s.blockRows,
    blockCols: s.blockCols,
    blockSpacing_m: s.blockSpacing_m ?? null,
    blockEdge_m: s.blockEdge_m,
    blockThickness_m: s.blockThickness_m ?? 0.5,
    blockEfficiency: s.blockEfficiency ?? null,
    blockEmbedment_m: s.blockEmbedment_m ?? 0.1,
    padm_kN: s.result?.atTip.governingPadm_kN ?? null,
    blockResult: s.blockResult,
    structural: s.structural,
    footingResult: s.footingResult,
    fck_MPa: s.fck_MPa ?? null,
    fyk_MPa: s.fyk_MPa ?? 500,
    pileTypeId: s.pileTypeId,
    cover_mm: s.cover_mm ?? 50,
    designLoad_kN: s.designLoad_kN,
  };
}

export function storeToMemorialInput(
  s: MemorialStoreSnapshot,
  opts?: { generatedAtIso?: string; softwareVersion?: string },
): MemorialInput {
  const pile = getPileType(s.pileTypeId);
  const isPilePath = s.foundationKind === "pile" || s.foundationKind === "pile_cap";
  const datum = resolvePileDatum({
    foundationKind: s.foundationKind,
    tipDepth_m: s.tipDepth_m,
    blockThickness_m: s.blockThickness_m ?? 0.5,
    blockEmbedment_m: s.blockEmbedment_m ?? 0.1,
    pileTopElevation_m: s.pileTopElevation_m ?? 0,
  });

  const coverCm = (s.cover_mm ?? 50) / 10;
  const generalData = {
    concretePiles: `C${s.fck_MPa ?? 20}`,
    concreteCaps: `C${s.fck_MPa ?? 30}`,
    steelGrade: "CA-50 (longitudinal) / CA-60 (transversal)",
    coverTop_cm: Math.max(5.0, coverCm),
    coverBottom_cm: Math.max(5.0, coverCm),
    coverLateral_cm: Math.max(5.0, coverCm),
    coverStarter_cm: 5.0,
    maxAggregateSize_mm: 30,
    leanConcreteThickness_cm: 10.0,
    standards: [
      "ABNT NBR 6118:2023 (Projeto de estruturas de concreto)",
      "ABNT NBR 6122:2019 (Projeto e execução de fundações)",
      "ABNT NBR 7480:2022 (Aço destinado a armaduras de concreto armado)",
      "ABNT NBR 8800:2024 (Projeto de estruturas de aço e mistas)",
    ],
  };

  const loadsTable: MemorialInput["loadsTable"] = [];
  if (s.columns && s.columns.length > 0) {
    for (const col of s.columns) {
      loadsTable.push({
        element: col.columnLabel || "P01",
        combination: "Característica (Rara)",
        N_kN: col.N_kN ?? s.designLoad_kN ?? 0,
        Mx_kNm: col.Mx_kNm ?? 0,
        My_kNm: col.My_kNm ?? 0,
        Vx_kN: col.Qx_kN ?? 0,
        Vy_kN: col.Qy_kN ?? 0,
        Mt_kNm: 0,
      });
    }
  } else if (s.columnLoad) {
    loadsTable.push({
      element: s.columnLoad.columnLabel || "P01",
      combination: "Característica (Rara)",
      N_kN: s.columnLoad.N_kN ?? s.designLoad_kN ?? 0,
      Mx_kNm: s.columnLoad.Mx_kNm ?? 0,
      My_kNm: s.columnLoad.My_kNm ?? 0,
      Vx_kN: s.columnLoad.Qx_kN ?? 0,
      Vy_kN: s.columnLoad.Qy_kN ?? 0,
      Mt_kNm: 0,
    });
  } else if (s.designLoad_kN != null) {
    loadsTable.push({
      element: "P01",
      combination: "Característica (Rara)",
      N_kN: s.designLoad_kN,
      Mx_kNm: 0,
      My_kNm: 0,
      Vx_kN: 0,
      Vy_kN: 0,
      Mt_kNm: 0,
    });
  }

  const outputs =
    s.foundationKind === "pile" ||
    s.foundationKind === "pile_cap" ||
    s.foundationKind === "footing"
      ? buildProjectOutputs(toOutputsSource(s))
      : null;

  const elementTakeoffs: ElementTakeoff[] = [
    ...(outputs?.takeoffElements ?? []),
  ];
  if (elementTakeoffs.length === 0 && s.foundationKind === "pile_cap" && s.blockResult) {
    elementTakeoffs.push(
      computeBlockTakeoff({
        elementRef: "Bloco",
        pileCount: s.blockResult.pileCount,
        width_m: s.blockResult.cap.width_m,
        length_m: s.blockResult.cap.length_m,
        thickness_m: s.blockResult.cap.thickness_m,
        cover_m: coverCm / 100,
        concreteGrade: `C${s.fck_MPa ?? 30}`,
      }),
    );
    if (s.structural?.takeoff) {
      const count = s.blockResult.pileCount;
      for (let i = 1; i <= count; i++) {
        elementTakeoffs.push({
          ...s.structural.takeoff,
          elementRef: count === 1 ? "Estaca E01" : `Estaca E${i}`,
        });
      }
    }
  } else if (elementTakeoffs.length === 0 && s.foundationKind === "pile" && s.structural?.takeoff) {
    elementTakeoffs.push({
      ...s.structural.takeoff,
      elementRef: "Estaca E01",
    });
  }

  const takeoffSummary =
    outputs?.drawingInput.takeoffSummary ??
    (elementTakeoffs.length > 0 ? aggregateProjectTakeoff(elementTakeoffs) : undefined);

  const columnBlocks =
    outputs && outputs.columnBlocks.length > 0
      ? outputs.columnBlocks.map((cb) => ({
          columnLabel: cb.columnLabel,
          N_kN: cb.N_kN,
          Mx_kNm: cb.Mx_kNm,
          My_kNm: cb.My_kNm,
          pileCount: cb.pileCount,
          rows: cb.layout.blockRows,
          cols: cb.layout.blockCols,
          spacing_m: cb.block.spacing_m,
          edge_m: cb.layout.blockEdge_m,
          thickness_m: cb.block.cap.thickness_m,
          width_m: cb.block.cap.width_m,
          length_m: cb.block.cap.length_m,
          groupPadm_kN: cb.block.groupPadm_kN,
          efficiency: cb.block.efficiency,
          efficiencyUserProvided: cb.block.efficiencyUserProvided,
          groupCapacityIndicative: cb.block.groupCapacityIndicative,
          capacityOk: cb.block.capacityOk,
          warnings: cb.block.warnings,
        }))
      : null;

  return {
    generatedAtIso: opts?.generatedAtIso ?? new Date().toISOString(),
    softwareVersion: opts?.softwareVersion ?? "0.1.0",
    project: {
      name: s.projectName,
      code: s.projectCode,
      client: s.client,
      location: s.location,
    },
    generalData,
    loadsTable,
    elementTakeoffs: elementTakeoffs.length > 0 ? elementTakeoffs : undefined,
    takeoffSummary,
    pile: isPilePath
      ? {
          typeLabel: pile.name,
          diameter_cm: s.diameterCm,
          tipDepth_m: s.tipDepth_m,
          sptTipDepth_m: datum.sptTipDepth_m,
          pileTopDepth_m: datum.pileTopDepth_m,
          area_cm2: s.areaCm2 === "" ? undefined : Number(s.areaCm2),
          perimeter_cm: s.perimeterCm === "" ? undefined : Number(s.perimeterCm),
        }
      : null,
    site: { waterLevel_m: isPilePath || s.foundationKind === "caisson" ? s.waterLevel_m : null },
    layers:
      isPilePath || s.foundationKind === "caisson"
        ? s.layers.map((l) => ({
            depth_m: l.depth_m,
            nspt: l.nspt,
            soilLabel: getSoilType(l.soilTypeId).name,
          }))
        : [],
    designLoad_kN: s.designLoad_kN,
    methods: isPilePath
      ? {
          mode: s.mode,
          governingRule: s.governingRule,
          selectedMethod: s.selectedMethod ?? null,
          aokiFs: s.aokiFs,
          aokiPctTip: s.aokiPctTip,
          aokiPctShaft: s.aokiPctShaft,
          decourtAlphaPct: s.decourtAlphaPct,
          decourtBetaPct: s.decourtBetaPct,
          teixeiraFs: s.teixeiraFs,
          teixeiraPctTip: s.teixeiraPctTip,
          teixeiraPctShaft: s.teixeiraPctShaft,
        }
      : null,
    geotechnical: isPilePath ? s.result : null,
    structural: isPilePath ? s.structural : null,
    columnBlocks,
    block:
      s.foundationKind === "pile_cap" && s.blockResult
        ? {
            pileCount: s.blockResult.pileCount,
            spacing_m: s.blockResult.spacing_m,
            rows: s.blockRows,
            cols: s.blockCols,
            edge_m: s.blockEdge_m,
            thickness_m: s.blockResult.cap.thickness_m,
            embedment_m: s.blockEmbedment_m ?? 0.1,
            width_m: s.blockResult.cap.width_m,
            length_m: s.blockResult.cap.length_m,
            groupPadm_kN: s.blockResult.groupPadm_kN,
            efficiency: s.blockResult.efficiency,
            efficiencyUserProvided: s.blockResult.efficiencyUserProvided,
            groupCapacityIndicative: s.blockResult.groupCapacityIndicative,
            capacityOk: s.blockResult.capacityOk,
            warnings: s.blockResult.warnings,
            punchingMessage: s.blockResult.punching?.message ?? null,
            strutTieMessage: s.blockResult.strutTie?.message ?? null,
            rebarMessage: s.blockResult.rebar?.message ?? null,
          }
        : null,
    footing:
      s.foundationKind === "footing" && s.footingResult
        ? {
            shape: s.footingShape,
            admMode: s.footingAdmMode,
            Nd_kN: s.footingResult.Nd_kN,
            B_m: s.footingResult.B_m,
            L_m: s.footingResult.L_m,
            area_m2: s.footingResult.area_m2,
            thickness_m: s.footingResult.thickness_m,
            qadm_kPa: s.footingResult.qadm_kPa,
            qult_kPa: s.footingResult.qult_kPa,
            sigmaAvg_kPa: s.footingResult.sigmaAvg_kPa,
            sigmaMax_kPa: s.footingResult.sigmaMax_kPa,
            checksOk: s.footingResult.checks.every((c) => c.status !== "error"),
            warnings: s.footingResult.warnings,
            rebarMessage: s.footingResult.rebar?.message ?? null,
          }
        : null,
    caisson:
      s.foundationKind === "caisson" && s.caissonResult
        ? {
            Nd_kN: s.caissonResult.Nd_kN,
            shaftDiameter_m: s.caissonResult.shaftDiameter_m,
            baseDiameter_m: s.caissonResult.baseDiameter_m,
            length_m: s.caissonResult.length_m,
            Rp_adm_kN: s.caissonResult.Rp_adm_kN,
            Rl_adm_kN: s.caissonResult.Rl_adm_kN,
            Padm_kN: s.caissonResult.Padm_kN,
            verdict: s.caissonResult.verdict,
            shaftMode: s.caissonResult.shaftMode,
            warnings: s.caissonResult.warnings,
            rebarMessage: s.caissonResult.rebar?.message ?? null,
          }
        : null,
    raft:
      s.foundationKind === "raft" && s.raftResult
        ? {
            Nd_kN: s.raftResult.Nd_kN,
            B_m: s.raftResult.B_m,
            L_m: s.raftResult.L_m,
            area_m2: s.raftResult.area_m2,
            thickness_m: s.raftResult.thickness_m,
            qadm_kPa: s.raftResult.qadm_kPa,
            sigmaAvg_kPa: s.raftResult.sigmaAvg_kPa,
            sigmaMax_kPa: s.raftResult.sigmaMax_kPa,
            checksOk: s.raftResult.checks.every((c) => c.status !== "error"),
            warnings: s.raftResult.warnings,
            rebarMessage: s.raftResult.rebar?.message ?? null,
          }
        : null,
  };
}

export function buildMemorialFromStore(s: MemorialStoreSnapshot) {
  const input = storeToMemorialInput(s);
  const doc = buildMemorialDocument(input);
  return {
    doc,
    markdown: memorialToMarkdown(doc),
    html: memorialToHtml(doc),
  };
}
