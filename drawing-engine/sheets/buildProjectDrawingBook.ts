import type { A4Sheet, DrawingProjectBook, TitleBlockInfo } from "../core/types";
import { drawGeneralSheet, type GeneralElementRow } from "./drawGeneralSheet";
import { drawPileCapSheet } from "./drawPileCapSheet";
import { drawPileSheet } from "./drawPileSheet";
import { drawFootingSheet } from "./drawFootingSheet";
import type { BlockDesignResult } from "../../block-engine/types";
import type { FootingDesignResult } from "../../footing-engine/types";
import type { ElementTakeoff, ProjectTakeoffSummary } from "../../structural-engine/takeoff/types";

export interface DrawingBookPileInput {
  diameter_m: number;
  length_m: number;
  pileCount: number;
  ref: string;
  takeoff?: ElementTakeoff;
  longitudinalCount?: number;
  longitudinalDia_mm?: number;
  cageLength_m?: number;
  transverseKind?: "stirrup" | "spiral";
}

export interface DrawingBookInput {
  projectName: string;
  projectCode?: string;
  client?: string;
  location?: string;
  engineerName?: string;
  crea?: string;
  date?: string;
  companyLogoBase64?: string;
  blocks?: Array<{
    result: BlockDesignResult;
    pileDiameter_m: number;
    pierWidth_m?: number;
    pierLength_m?: number;
    /** Comprimento do fuste exibido no corte (m). */
    pileShaftLength_m?: number;
    ref: string;
    takeoff?: ElementTakeoff;
    /** Carga vertical do pilar (kN), como informada nas Cargas. */
    columnLoad_kN?: number;
  }>;
  piles?: DrawingBookPileInput[];
  footings?: Array<{
    result: FootingDesignResult;
    pierWidth_m?: number;
    pierLength_m?: number;
    ref: string;
    takeoff?: ElementTakeoff;
    /** Carga vertical do pilar (kN), como informada nas Cargas. */
    columnLoad_kN?: number;
  }>;
  takeoffSummary?: ProjectTakeoffSummary;
  generalNotes?: string[];
}

/**
 * Constrói o Caderno de Pranchas Executivas em Formato A4 (297 x 210 mm)
 * com paginação automática, escalonamento ABNT, esquemas de barras desdobradas,
 * tabelas de ferros e carimbos técnicos com logotipo da empresa.
 */
export function buildProjectDrawingBook(input: DrawingBookInput): DrawingProjectBook {
  const currentDate = input.date ?? new Date().toLocaleDateString("pt-BR");
  const blocks = input.blocks ?? [];
  const piles = input.piles ?? [];
  const footings = input.footings ?? [];

  const totalSheets = 1 + blocks.length + piles.length + footings.length;
  const sheets: A4Sheet[] = [];

  const generalElements: GeneralElementRow[] = [];
  let sheetCursor = 2;

  blocks.forEach((b) => {
    generalElements.push({
      elementRef: b.ref,
      kind: `Bloco ${b.result.pileCount}E (Ø${Math.round(b.pileDiameter_m * 100)}cm)`,
      dimensions: `${Math.round(b.result.cap.width_m * 100)}×${Math.round(b.result.cap.length_m * 100)}×${Math.round(b.result.cap.thickness_m * 100)}`,
      load_kN: b.columnLoad_kN ?? 0,
      sheetRef: `Prancha ${String(sheetCursor).padStart(2, "0")}`,
    });
    sheetCursor++;
  });

  piles.forEach((p) => {
    generalElements.push({
      elementRef: p.ref,
      kind: `Estaca Ø${Math.round(p.diameter_m * 100)}cm${p.pileCount > 1 ? ` ×${p.pileCount}` : ""}`,
      dimensions: `L=${Math.round(p.length_m * 100)} · Ø${Math.round(p.diameter_m * 100)}`,
      load_kN: 0,
      sheetRef: `Prancha ${String(sheetCursor).padStart(2, "0")}`,
    });
    sheetCursor++;
  });

  footings.forEach((f) => {
    generalElements.push({
      elementRef: f.ref,
      kind: "Sapata Isolada",
      dimensions: `${Math.round(f.result.B_m * 100)}×${Math.round(f.result.L_m * 100)}×${Math.round(f.result.thickness_m * 100)}`,
      load_kN: f.columnLoad_kN ?? f.result.Nk_kN,
      sheetRef: `Prancha ${String(sheetCursor).padStart(2, "0")}`,
    });
    sheetCursor++;
  });

  const baseTitleInfo: Omit<TitleBlockInfo, "sheetNumber" | "elementRef" | "drawingTitle" | "scaleLabel"> = {
    projectName: input.projectName,
    projectCode: input.projectCode,
    client: input.client,
    location: input.location,
    engineerName: input.engineerName,
    crea: input.crea,
    date: currentDate,
    totalSheets,
    companyLogoBase64: input.companyLogoBase64,
  };

  const generalSheet = drawGeneralSheet({
    titleInfo: {
      ...baseTitleInfo,
      sheetNumber: 1,
      elementRef: "GERAL",
      drawingTitle: "FOLHA DE ROSTO E QUADRO GERAL",
      scaleLabel: "VER DET.",
    },
    elements: generalElements,
    takeoffSummary: input.takeoffSummary,
    notes: input.generalNotes,
  });
  sheets.push(generalSheet);

  let currentSheetNum = 2;
  blocks.forEach((b) => {
    const sheet = drawPileCapSheet({
      blockResult: b.result,
      pileDiameter_m: b.pileDiameter_m,
      pierWidth_m: b.pierWidth_m,
      pierLength_m: b.pierLength_m,
      pileShaftLength_m: b.pileShaftLength_m,
      titleInfo: {
        ...baseTitleInfo,
        sheetNumber: currentSheetNum,
        elementRef: b.ref,
        drawingTitle: "DETALHE — BLOCO",
        scaleLabel: "VER DET.",
      },
      takeoff: b.takeoff,
    });
    sheets.push(sheet);
    currentSheetNum++;
  });

  piles.forEach((p) => {
    const sheet = drawPileSheet({
      diameter_m: p.diameter_m,
      length_m: p.length_m,
      pileCount: p.pileCount,
      longitudinalCount: p.longitudinalCount,
      longitudinalDia_mm: p.longitudinalDia_mm,
      cageLength_m: p.cageLength_m,
      transverseKind: p.transverseKind,
      titleInfo: {
        ...baseTitleInfo,
        sheetNumber: currentSheetNum,
        elementRef: p.ref,
        drawingTitle: "DETALHE — ESTACA",
        scaleLabel: "VER DET.",
      },
      takeoff: p.takeoff,
    });
    sheets.push(sheet);
    currentSheetNum++;
  });

  footings.forEach((f) => {
    const sheet = drawFootingSheet({
      footingResult: f.result,
      pierWidth_m: f.pierWidth_m,
      pierLength_m: f.pierLength_m,
      titleInfo: {
        ...baseTitleInfo,
        sheetNumber: currentSheetNum,
        elementRef: f.ref,
        drawingTitle: "DETALHE — SAPATA",
        scaleLabel: "VER DET.",
      },
      takeoff: f.takeoff,
    });
    sheets.push(sheet);
    currentSheetNum++;
  });

  return {
    projectName: input.projectName,
    totalSheets,
    sheets,
  };
}
