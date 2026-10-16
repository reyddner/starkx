import type {
  A4Sheet,
  DrawingPrimitive,
  TitleBlockInfo,
} from "../core/types";
import { createLinearDimension } from "../core/dimensionHelper";
import { createModelToSheetTransform, selectBestScale } from "../core/autoScale";
import { sheetRectFromModel } from "../core/rectHelper";
import { drawRebarShape } from "../rebars/rebarShapeDrafter";
import { extractRebarShapes } from "../rebars/rebarExtractor";
import { drawRebarTable } from "./drawRebarTable";
import { drawTitleBlock } from "./drawTitleBlock";
import { drawSheetBorders } from "./sheetBorders";
import type { FootingDesignResult } from "../../footing-engine/types";
import type { ElementTakeoff } from "../../structural-engine/takeoff/types";

export interface FootingSheetInput {
  footingResult: FootingDesignResult;
  pierWidth_m?: number;
  pierLength_m?: number;
  titleInfo: TitleBlockInfo;
  takeoff?: ElementTakeoff;
}

export function drawFootingSheet(input: FootingSheetInput): A4Sheet {
  const { footingResult, titleInfo } = input;
  const B = footingResult.B_m;
  const L = footingResult.L_m;
  const H = footingResult.thickness_m;
  const h0 = Math.max(0.15, Number((H / 3).toFixed(2))); // altura da aba
  const pierW = input.pierWidth_m ?? 0.30;
  const pierL = input.pierLength_m ?? 0.30;

  const primitives: DrawingPrimitive[] = [];

  // 1. Moldura ABNT
  primitives.push(...drawSheetBorders());

  // -------------------------------------------------------------
  // 2. PLANTA BAIXA DA SAPATA (x: 22 a 118, y: 12 a 105)
  // -------------------------------------------------------------
  const planBox = { x: 22, y: 12, width: 95, height: 90 };
  const planScale = selectBestScale(
    { width_m: B, length_m: L },
    { x: planBox.x, y: planBox.y, width: planBox.width, height: planBox.height - 12 },
  );
  const planTransform = createModelToSheetTransform(
    { width_m: B, length_m: L },
    { x: planBox.x, y: planBox.y + 6, width: planBox.width, height: planBox.height - 12 },
    planScale,
  );

  // Título
  primitives.push({
    type: "text",
    text: `PLANTA BAIXA (ESCALA ${planScale.scaleLabel})`,
    x: planBox.x + planBox.width / 2,
    y: planBox.y + 3,
    fontSize: 6.0,
    align: "center",
    baseline: "middle",
    color: "#7A5820",
    bold: true,
  });

  const ft = sheetRectFromModel(
    planTransform.toSheetPoint,
    { x: -B / 2, y: L / 2 },
    { x: B / 2, y: -L / 2 },
  );

  // Contorno da Sapata
  primitives.push({
    type: "rect",
    x: ft.x,
    y: ft.y,
    width: ft.width,
    height: ft.height,
    strokeWidth: 0.6,
    strokeColor: "#000000",
    fillColor: "#fbfcfd",
  });

  // Linhas das abas inclinadas (se h0 < H)
  const pierPlan = sheetRectFromModel(
    planTransform.toSheetPoint,
    { x: -pierW / 2, y: pierL / 2 },
    { x: pierW / 2, y: -pierL / 2 },
  );

  primitives.push(
    // Linhas diagonais das abas
    {
      type: "line",
      x1: ft.left,
      y1: ft.top,
      x2: pierPlan.left,
      y2: pierPlan.top,
      strokeWidth: 0.25,
      strokeColor: "#999999",
    },
    {
      type: "line",
      x1: ft.right,
      y1: ft.top,
      x2: pierPlan.right,
      y2: pierPlan.top,
      strokeWidth: 0.25,
      strokeColor: "#999999",
    },
    {
      type: "line",
      x1: ft.right,
      y1: ft.bottom,
      x2: pierPlan.right,
      y2: pierPlan.bottom,
      strokeWidth: 0.25,
      strokeColor: "#999999",
    },
    {
      type: "line",
      x1: ft.left,
      y1: ft.bottom,
      x2: pierPlan.left,
      y2: pierPlan.bottom,
      strokeWidth: 0.25,
      strokeColor: "#999999",
    },
  );

  // Pilar de arranque
  primitives.push({
    type: "rect",
    x: pierPlan.x,
    y: pierPlan.y,
    width: pierPlan.width,
    height: pierPlan.height,
    strokeWidth: 0.5,
    strokeColor: "#000000",
    fillColor: "#d0d7de",
  });

  // Eixos centrais
  const centerPt = planTransform.toSheetPoint({ x: 0, y: 0 });
  primitives.push(
    {
      type: "line",
      x1: ft.left - 3,
      y1: centerPt.y,
      x2: ft.right + 3,
      y2: centerPt.y,
      strokeWidth: 0.2,
      strokeColor: "#b30000",
      dashPattern: [2.0, 1.0],
    },
    {
      type: "line",
      x1: centerPt.x,
      y1: ft.top - 3,
      x2: centerPt.x,
      y2: ft.bottom + 3,
      strokeWidth: 0.2,
      strokeColor: "#b30000",
      dashPattern: [2.0, 1.0],
    },
  );

  // Cotas na Planta:
  // Cota B (horizontal inferior)
  primitives.push(
    ...createLinearDimension({
      start: { x: ft.left, y: ft.bottom },
      end: { x: ft.right, y: ft.bottom },
      offset_mm: 5.5,
      measurement_cm: Math.round(B * 100),
      orientation: "horizontal",
    }),
  );

  // Cota L (vertical à direita)
  primitives.push(
    ...createLinearDimension({
      start: { x: ft.right, y: ft.top },
      end: { x: ft.right, y: ft.bottom },
      offset_mm: 5.5,
      measurement_cm: Math.round(L * 100),
      orientation: "vertical",
    }),
  );

  // -------------------------------------------------------------
  // 3. CORTE VERTICAL A-A (x: 22 a 118, y: 108 a 200)
  // -------------------------------------------------------------
  const secBox = { x: 22, y: 108, width: 95, height: 90 };
  const leanH = 0.05;
  const pierStickUp = 0.25;
  const totalSecModelH = H + leanH + pierStickUp;

  const secScale = selectBestScale(
    { width_m: B, length_m: totalSecModelH },
    { x: secBox.x, y: secBox.y, width: secBox.width, height: secBox.height - 12 },
  );

  const secTransform = createModelToSheetTransform(
    {
      width_m: B,
      length_m: totalSecModelH,
      // O corte vai de -magro até (altura da sapata + arranque).
      centerY_m: (H + pierStickUp - leanH) / 2,
    },
    { x: secBox.x, y: secBox.y + 6, width: secBox.width, height: secBox.height - 12 },
    secScale,
  );

  primitives.push({
    type: "text",
    text: `CORTE VERTICAL A-A (ESCALA ${secScale.scaleLabel})`,
    x: secBox.x + secBox.width / 2,
    y: secBox.y + 3,
    fontSize: 6.0,
    align: "center",
    baseline: "middle",
    color: "#7A5820",
    bold: true,
  });

  const secBotLeft = secTransform.toSheetPoint({ x: -B / 2, y: 0 });
  const secBotRight = secTransform.toSheetPoint({ x: B / 2, y: 0 });
  const secAbaLeft = secTransform.toSheetPoint({ x: -B / 2, y: h0 });
  const secAbaRight = secTransform.toSheetPoint({ x: B / 2, y: h0 });
  const secPierTopL = secTransform.toSheetPoint({ x: -pierW / 2, y: H + pierStickUp });
  const secPierBotL = secTransform.toSheetPoint({ x: -pierW / 2, y: H });
  const secPierBotR = secTransform.toSheetPoint({ x: pierW / 2, y: H });
  const secPierTopR = secTransform.toSheetPoint({ x: pierW / 2, y: H + pierStickUp });

  // Contorno da sapata em corte (polígono de linhas)
  primitives.push(
    {
      type: "line",
      x1: secBotLeft.x,
      y1: secBotLeft.y,
      x2: secBotRight.x,
      y2: secBotRight.y,
      strokeWidth: 0.6,
      strokeColor: "#000000",
    },
    {
      type: "line",
      x1: secBotRight.x,
      y1: secBotRight.y,
      x2: secAbaRight.x,
      y2: secAbaRight.y,
      strokeWidth: 0.6,
      strokeColor: "#000000",
    },
    {
      type: "line",
      x1: secAbaRight.x,
      y1: secAbaRight.y,
      x2: secPierBotR.x,
      y2: secPierBotR.y,
      strokeWidth: 0.6,
      strokeColor: "#000000",
    },
    {
      type: "line",
      x1: secPierBotR.x,
      y1: secPierBotR.y,
      x2: secPierBotL.x,
      y2: secPierBotL.y,
      strokeWidth: 0.6,
      strokeColor: "#000000",
    },
    {
      type: "line",
      x1: secPierBotL.x,
      y1: secPierBotL.y,
      x2: secAbaLeft.x,
      y2: secAbaLeft.y,
      strokeWidth: 0.6,
      strokeColor: "#000000",
    },
    {
      type: "line",
      x1: secAbaLeft.x,
      y1: secAbaLeft.y,
      x2: secBotLeft.x,
      y2: secBotLeft.y,
      strokeWidth: 0.6,
      strokeColor: "#000000",
    },
  );

  // Pilar de arranque
  primitives.push({
    type: "rect",
    x: secPierTopL.x,
    y: secPierTopL.y,
    width: Math.abs(secPierTopR.x - secPierTopL.x),
    height: Math.abs(secPierBotL.y - secPierTopL.y),
    strokeWidth: 0.5,
    strokeColor: "#000000",
    fillColor: "#d0d7de",
  });

  // Concreto Magro abaixo da sapata
  const secLeanL = secTransform.toSheetPoint({ x: -B / 2 - 0.05, y: -leanH });
  const secLeanR = secTransform.toSheetPoint({ x: B / 2 + 0.05, y: 0 });
  primitives.push({
    type: "rect",
    x: secLeanL.x,
    y: secLeanR.y,
    width: Math.abs(secLeanR.x - secLeanL.x),
    height: Math.abs(secLeanL.y - secLeanR.y),
    strokeWidth: 0.3,
    strokeColor: "#666666",
    fillColor: "#eceff1",
  });

  // Armadura inferior em U (vermelha)
  const coverSheet = 0.05 * secTransform.scaleFactor;
  const hookSheet = (h0 - 0.06) * secTransform.scaleFactor;
  const rebarY = secBotLeft.y - coverSheet;
  const rebarLX = secBotLeft.x + coverSheet;
  const rebarRX = secBotRight.x - coverSheet;

  primitives.push(
    {
      type: "line",
      x1: rebarLX,
      y1: rebarY,
      x2: rebarRX,
      y2: rebarY,
      strokeWidth: 0.5,
      strokeColor: "#b30000",
    },
    {
      type: "line",
      x1: rebarLX,
      y1: rebarY,
      x2: rebarLX,
      y2: rebarY - hookSheet,
      strokeWidth: 0.5,
      strokeColor: "#b30000",
    },
    {
      type: "line",
      x1: rebarRX,
      y1: rebarY,
      x2: rebarRX,
      y2: rebarY - hookSheet,
      strokeWidth: 0.5,
      strokeColor: "#b30000",
    },
  );

  // Cotas no Corte
  primitives.push(
    ...createLinearDimension({
      start: { x: secBotLeft.x, y: secPierBotL.y },
      end: { x: secBotLeft.x, y: secBotLeft.y },
      offset_mm: -6.0,
      measurement_cm: Math.round(H * 100),
      orientation: "vertical",
    }),
  );
  primitives.push(
    ...createLinearDimension({
      start: { x: secBotLeft.x, y: secBotLeft.y },
      end: { x: secBotRight.x, y: secBotLeft.y },
      offset_mm: 5.5,
      measurement_cm: Math.round(B * 100),
      orientation: "horizontal",
    }),
  );

  // -------------------------------------------------------------
  // 4. COLUNA CENTRAL: DESDOBRAMENTO DAS BARRAS (x: 120 a 184)
  // -------------------------------------------------------------
  const rebarColBox = { x: 120, y: 10, width: 64, height: 190 };
  primitives.push({
    type: "rect",
    x: rebarColBox.x,
    y: rebarColBox.y,
    width: rebarColBox.width,
    height: rebarColBox.height,
    strokeWidth: 0.4,
    strokeColor: "#000000",
    fillColor: "#ffffff",
  });

  const rebarHeaderH = 6.0;
  primitives.push({
    type: "rect",
    x: rebarColBox.x,
    y: rebarColBox.y,
    width: rebarColBox.width,
    height: rebarHeaderH,
    strokeWidth: 0.4,
    strokeColor: "#000000",
    fillColor: "#e6eef5",
  });
  primitives.push({
    type: "text",
    text: "DESDOBRAMENTO DAS BARRAS",
    x: rebarColBox.x + rebarColBox.width / 2,
    y: rebarColBox.y + rebarHeaderH / 2,
    fontSize: 5.8,
    align: "center",
    baseline: "middle",
    color: "#7A5820",
    bold: true,
  });

  // Se takeoff fornecido, extrai formas; senão gera padrão
  const rebarShapes = input.takeoff
    ? extractRebarShapes(input.takeoff, { width_m: B, length_m: L, height_m: H, cover_m: 0.05 })
    : [
        {
          posNumber: 1,
          label: "N1",
          name: "Malha inferior X",
          diameter_mm: footingResult.rebar?.suggestBar_mm ?? 10.0,
          steelGrade: "CA-50" as const,
          count: Math.max(4, Math.round((B * 100) / (footingResult.rebar?.suggestSpacing_cm ?? 15))),
          totalLength_m: 10,
          unitLength_cm: Math.round(L * 100 - 10 + 2 * Math.round(h0 * 100 - 6)),
          kind: "u_shape" as const,
          legs_cm: [Math.round(h0 * 100 - 6), Math.round(L * 100 - 10), Math.round(h0 * 100 - 6)],
        },
        {
          posNumber: 2,
          label: "N2",
          name: "Malha inferior Y",
          diameter_mm: footingResult.rebar?.suggestBar_mm ?? 10.0,
          steelGrade: "CA-50" as const,
          count: Math.max(4, Math.round((L * 100) / (footingResult.rebar?.suggestSpacing_cm ?? 15))),
          totalLength_m: 10,
          unitLength_cm: Math.round(B * 100 - 10 + 2 * Math.round(h0 * 100 - 6)),
          kind: "u_shape" as const,
          legs_cm: [Math.round(h0 * 100 - 6), Math.round(B * 100 - 10), Math.round(h0 * 100 - 6)],
        },
      ];

  const slotH = 34;
  rebarShapes.forEach((shape, idx) => {
    const slotY = rebarColBox.y + rebarHeaderH + 2 + idx * slotH;
    if (slotY + slotH <= rebarColBox.y + rebarColBox.height) {
      primitives.push(
        ...drawRebarShape(shape, {
          x: rebarColBox.x + 2,
          y: slotY,
          width: rebarColBox.width - 4,
          height: slotH - 2,
        }),
      );
    }
  });

  // -------------------------------------------------------------
  // 5. COLUNA DIREITA: TABELA E CARIMBO
  // -------------------------------------------------------------
  if (input.takeoff) {
    const tableRes = drawRebarTable(input.takeoff, { x: 187, y: 10, width: 100, maxHeight: 140 });
    primitives.push(...tableRes.primitives);
  }

  const fullTitleInfo: TitleBlockInfo = {
    ...titleInfo,
    scaleLabel: planScale.scaleLabel,
  };
  primitives.push(...drawTitleBlock(fullTitleInfo, { x: 185, y: 152, width: 100, height: 48 }));

  return {
    sheetNumber: titleInfo.sheetNumber,
    title: `${titleInfo.elementRef} — Detalhamento`,
    elementRef: titleInfo.elementRef,
    primitives,
    width_mm: 297,
    height_mm: 210,
  };
}
