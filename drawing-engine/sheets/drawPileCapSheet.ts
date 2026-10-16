import type {
  A4Sheet,
  DrawingPrimitive,
  TitleBlockInfo,
} from "../core/types";
import { createLinearDimension } from "../core/dimensionHelper";
import { createModelToSheetTransform, selectBestScale } from "../core/autoScale";
import { sheetRectFromModel } from "../core/rectHelper";
import { fitTextToWidth } from "../core/textFit";
import { drawRebarShape } from "../rebars/rebarShapeDrafter";
import { extractRebarShapes } from "../rebars/rebarExtractor";
import { drawRebarTable } from "./drawRebarTable";
import { drawTitleBlock } from "./drawTitleBlock";
import { drawSheetBorders } from "./sheetBorders";
import type { BlockDesignResult } from "../../block-engine/types";
import type { ElementTakeoff } from "../../structural-engine/takeoff/types";

export interface PileCapSheetInput {
  blockResult: BlockDesignResult;
  pileDiameter_m: number;
  pierWidth_m?: number;
  pierLength_m?: number;
  /** Comprimento do fuste abaixo do bloco no corte (m). Default 0,80. */
  pileShaftLength_m?: number;
  titleInfo: TitleBlockInfo;
  takeoff?: ElementTakeoff;
}

export function drawPileCapSheet(input: PileCapSheetInput): A4Sheet {
  const { blockResult, pileDiameter_m, titleInfo } = input;
  const pierW = input.pierWidth_m ?? 0.30;
  const pierL = input.pierLength_m ?? 0.30;
  const cap = blockResult.cap;
  const piles = blockResult.piles;
  const takeoff = input.takeoff ?? blockResult.takeoff;
  // L real (m) — o corte usa trecho visual limitado para caber na escala,
  // mas a cota/nota sempre mostra o comprimento geotécnico completo.
  const pileLengthReal_m = Math.max(0.5, input.pileShaftLength_m ?? 0.8);
  const pileShaftBelow = Math.min(1.5, Math.max(0.6, Math.min(pileLengthReal_m, 1.5)));

  const primitives: DrawingPrimitive[] = [];

  // 1. Moldura e margens da folha A4
  primitives.push(...drawSheetBorders());

  // -------------------------------------------------------------
  // Layout em 3 colunas sem sobreposição:
  //   planta/corte  x=22..116  |  desdobramento x=118..182  |  tabela/carimbo x=185..287
  // -------------------------------------------------------------
  const planBox = { x: 22, y: 12, width: 94, height: 90 };
  const planScale = selectBestScale(
    { width_m: cap.width_m, length_m: cap.length_m },
    { x: planBox.x, y: planBox.y, width: planBox.width, height: planBox.height - 12 },
  );
  const planTransform = createModelToSheetTransform(
    { width_m: cap.width_m, length_m: cap.length_m },
    { x: planBox.x, y: planBox.y + 6, width: planBox.width, height: planBox.height - 12 },
    planScale,
  );

  primitives.push({
    type: "text",
    text: fitTextToWidth(`PLANTA (${planScale.scaleLabel})`, 5.0, planBox.width - 4),
    x: planBox.x + planBox.width / 2,
    y: planBox.y + 3,
    fontSize: 5.0,
    align: "center",
    baseline: "middle",
    color: "#7A5820",
    bold: true,
  });

  // Retângulo do contorno do Bloco na folha
  const blk = sheetRectFromModel(
    planTransform.toSheetPoint,
    { x: -cap.width_m / 2, y: cap.length_m / 2 },
    { x: cap.width_m / 2, y: -cap.length_m / 2 },
  );
  const blkSheetW = blk.width;
  const blkSheetH = blk.height;

  primitives.push({
    type: "rect",
    x: blk.x,
    y: blk.y,
    width: blk.width,
    height: blk.height,
    strokeWidth: 0.6,
    strokeColor: "#000000",
    fillColor: "#fbfcfd",
  });

  // Estacas (Círculos + Eixos centrais)
  const pileR_sheet = (pileDiameter_m / 2) * planTransform.scaleFactor;
  piles.forEach((p) => {
    const pCenter = planTransform.toSheetPoint({ x: p.position.x_m, y: p.position.y_m });
    // Círculo da estaca
    primitives.push({
      type: "circle",
      cx: pCenter.x,
      cy: pCenter.y,
      r: pileR_sheet,
      strokeWidth: 0.4,
      strokeColor: "#000000",
      fillColor: "#eef2f6",
    });
    // Eixos da estaca (cruz tracejada)
    const crossExt = pileR_sheet + 2;
    primitives.push(
      {
        type: "line",
        x1: pCenter.x - crossExt,
        y1: pCenter.y,
        x2: pCenter.x + crossExt,
        y2: pCenter.y,
        strokeWidth: 0.2,
        strokeColor: "#888888",
        dashPattern: [1.5, 1.0],
      },
      {
        type: "line",
        x1: pCenter.x,
        y1: pCenter.y - crossExt,
        x2: pCenter.x,
        y2: pCenter.y + crossExt,
        strokeWidth: 0.2,
        strokeColor: "#888888",
        dashPattern: [1.5, 1.0],
      },
    );
  });

  // Pilar centralizado
  const pierPlan = sheetRectFromModel(
    planTransform.toSheetPoint,
    { x: -pierW / 2, y: pierL / 2 },
    { x: pierW / 2, y: -pierL / 2 },
  );
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

  // Eixos centrais do pilar
  const pierCenter = planTransform.toSheetPoint({ x: 0, y: 0 });
  const centerExtX = blkSheetW / 2 + 3;
  const centerExtY = blkSheetH / 2 + 3;
  primitives.push(
    {
      type: "line",
      x1: pierCenter.x - centerExtX,
      y1: pierCenter.y,
      x2: pierCenter.x + centerExtX,
      y2: pierCenter.y,
      strokeWidth: 0.2,
      strokeColor: "#b30000",
      dashPattern: [2.0, 1.0],
    },
    {
      type: "line",
      x1: pierCenter.x,
      y1: pierCenter.y - centerExtY,
      x2: pierCenter.x,
      y2: pierCenter.y + centerExtY,
      strokeWidth: 0.2,
      strokeColor: "#b30000",
      dashPattern: [2.0, 1.0],
    },
  );

  // Cotas na Planta:
  // 1. Cota de largura total Lx (horizontal abaixo do bloco)
  primitives.push(
    ...createLinearDimension({
      start: { x: blk.left, y: blk.bottom },
      end: { x: blk.right, y: blk.bottom },
      offset_mm: 5.5,
      measurement_cm: Math.round(cap.width_m * 100),
      orientation: "horizontal",
    }),
  );

  // 2. Cota de comprimento total Ly (vertical à direita do bloco)
  primitives.push(
    ...createLinearDimension({
      start: { x: blk.right, y: blk.top },
      end: { x: blk.right, y: blk.bottom },
      offset_mm: 5.5,
      measurement_cm: Math.round(cap.length_m * 100),
      orientation: "vertical",
    }),
  );

  // 3. Cota entre eixos de estacas (se houver mais de 1 estaca com espaçamento > 0)
  if (piles.length >= 2) {
    const p1 = piles[0];
    const p2 = piles[1];
    const pt1 = planTransform.toSheetPoint({ x: p1.position.x_m, y: p1.position.y_m });
    const pt2 = planTransform.toSheetPoint({ x: p2.position.x_m, y: p2.position.y_m });
    const dist_m = Math.hypot(p2.position.x_m - p1.position.x_m, p2.position.y_m - p1.position.y_m);
    if (dist_m > 0.05) {
      primitives.push(
        ...createLinearDimension({
          start: pt1,
          end: pt2,
          offset_mm: -6.0,
          measurement_cm: Math.round(dist_m * 100),
          orientation: Math.abs(pt2.y - pt1.y) < Math.abs(pt2.x - pt1.x) ? "horizontal" : "vertical",
          fontSize: 3.6,
        }),
      );
    }
  }

  // Linha de corte A-A tracejada na planta
  const cutLineY = pierCenter.y;
  primitives.push({
    type: "line",
    x1: blk.left - 4,
    y1: cutLineY,
    x2: blk.right + 4,
    y2: cutLineY,
    strokeWidth: 0.4,
    strokeColor: "#7A5820",
    dashPattern: [3.0, 1.5],
  });
  primitives.push(
    {
      type: "text",
      text: "A",
      x: blk.left - 6,
      y: cutLineY,
      fontSize: 6.5,
      align: "center",
      baseline: "middle",
      color: "#7A5820",
      bold: true,
    },
    {
      type: "text",
      text: "A",
      x: blk.right + 6,
      y: cutLineY,
      fontSize: 6.5,
      align: "center",
      baseline: "middle",
      color: "#7A5820",
      bold: true,
    },
  );

  // -------------------------------------------------------------
  // 3. CORTE VERTICAL A-A (Área: x: 22 a 118, y: 108 a 200)
  // -------------------------------------------------------------
  const secBox = { x: 22, y: 108, width: 94, height: 90 };
  const capH = cap.thickness_m;
  const leanH = 0.08;
  const pileEmbed = 0.10;
  const pierStickUp = 0.25;

  const totalSecModelH = capH + leanH + pileEmbed + pierStickUp + pileShaftBelow;
  const secScale = selectBestScale(
    { width_m: cap.width_m, length_m: totalSecModelH },
    { x: secBox.x, y: secBox.y, width: secBox.width, height: secBox.height - 12 },
  );

  const secTransform = createModelToSheetTransform(
    {
      width_m: cap.width_m,
      length_m: totalSecModelH,
      // O corte vai de -(magro + fuste) até (topo do bloco + arranque).
      centerY_m: (capH + pierStickUp - leanH - pileShaftBelow) / 2,
    },
    { x: secBox.x, y: secBox.y + 6, width: secBox.width, height: secBox.height - 12 },
    secScale,
  );

  // Título da Vista de Corte
  primitives.push({
    type: "text",
    text: fitTextToWidth(
      `CORTE A-A (${secScale.scaleLabel}) L=${pileLengthReal_m.toFixed(2)}m`,
      4.8,
      secBox.width - 4,
    ),
    x: secBox.x + secBox.width / 2,
    y: secBox.y + 3,
    fontSize: 4.8,
    align: "center",
    baseline: "middle",
    color: "#7A5820",
    bold: true,
  });

  // Coordenadas do modelo no corte:
  // Base do bloco: Y = 0
  // Topo do bloco: Y = capH
  // Fundo do concreto magro: Y = -leanH
  // Base das estacas desenhadas: Y = -pileEmbed - 0.20
  // Topo do pilar de arranque: Y = capH + pierStickUp

  const secBlk = sheetRectFromModel(
    secTransform.toSheetPoint,
    { x: -cap.width_m / 2, y: capH },
    { x: cap.width_m / 2, y: 0 },
  );

  // Retângulo do Bloco no Corte
  primitives.push({
    type: "rect",
    x: secBlk.x,
    y: secBlk.y,
    width: secBlk.width,
    height: secBlk.height,
    strokeWidth: 0.6,
    strokeColor: "#000000",
    fillColor: "#fbfcfd",
  });

  // Concreto Magro abaixo do bloco
  const secLean = sheetRectFromModel(
    secTransform.toSheetPoint,
    { x: -cap.width_m / 2 - 0.05, y: 0 },
    { x: cap.width_m / 2 + 0.05, y: -leanH },
  );
  primitives.push({
    type: "rect",
    x: secLean.x,
    y: secLean.y,
    width: secLean.width,
    height: secLean.height,
    strokeWidth: 0.3,
    strokeColor: "#666666",
    fillColor: "#eceff1",
  });
  // Anotação concreto magro — à direita da faixa, sem invadir a coluna central
  const magroX = Math.min(secLean.right + 2, secBox.x + secBox.width - 14);
  primitives.push({
    type: "text",
    text: "MAGRO",
    x: magroX,
    y: (secLean.top + secLean.bottom) / 2,
    fontSize: 3.2,
    align: "left",
    baseline: "middle",
    color: "#666666",
  });
  primitives.push({
    type: "text",
    text: `e=${Math.round(leanH * 100)}cm`,
    x: magroX,
    y: (secLean.top + secLean.bottom) / 2 + 3.2,
    fontSize: 3.0,
    align: "left",
    baseline: "middle",
    color: "#888888",
  });

  // Pilar de arranque no corte
  const secPier = sheetRectFromModel(
    secTransform.toSheetPoint,
    { x: -pierW / 2, y: capH + pierStickUp },
    { x: pierW / 2, y: capH },
  );
  primitives.push({
    type: "rect",
    x: secPier.x,
    y: secPier.y,
    width: secPier.width,
    height: secPier.height,
    strokeWidth: 0.5,
    strokeColor: "#000000",
    fillColor: "#d0d7de",
  });

  // Estacas em corte penetrando 10cm no bloco
  // Agrupa estacas por coordenadas X para projetar no corte transversal
  const uniqueXMap = new Map<number, number>();
  piles.forEach((p) => {
    const rx = Math.round(p.position.x_m * 100) / 100;
    uniqueXMap.set(rx, p.position.x_m);
  });

  uniqueXMap.forEach((xm) => {
    const pileRect = sheetRectFromModel(
      secTransform.toSheetPoint,
      { x: xm - pileDiameter_m / 2, y: pileEmbed },
      { x: xm + pileDiameter_m / 2, y: -pileShaftBelow },
    );

    primitives.push({
      type: "rect",
      x: pileRect.x,
      y: pileRect.y,
      width: pileRect.width,
      height: pileRect.height,
      strokeWidth: 0.4,
      strokeColor: "#000000",
      fillColor: "#e6eef5",
    });

    // Linha de embutimento no bloco (10cm) tracejada
    const embedLine = secTransform.toSheetPoint({ x: xm, y: 0 });
    primitives.push({
      type: "line",
      x1: pileRect.left,
      y1: embedLine.y,
      x2: pileRect.right,
      y2: embedLine.y,
      strokeWidth: 0.3,
      strokeColor: "#b30000",
      dashPattern: [1.5, 1.0],
    });

    // Indicação esquemática da gaiola (2 longitudinais no corte)
    const cover = 0.05;
    for (const sx of [xm - pileDiameter_m / 2 + cover, xm + pileDiameter_m / 2 - cover]) {
      const bTop = secTransform.toSheetPoint({ x: sx, y: pileEmbed });
      const bBot = secTransform.toSheetPoint({ x: sx, y: -pileShaftBelow * 0.85 });
      primitives.push({
        type: "line",
        x1: bTop.x,
        y1: bTop.y,
        x2: bBot.x,
        y2: bBot.y,
        strokeWidth: 0.45,
        strokeColor: "#b30000",
      });
    }
  });

  // Armaduras em corte (linhas conceituais)
  // Armadura inferior (tirante): linha horizontal rente ao fundo com dobras verticais nas pontas
  const coverSheet = 0.05 * secTransform.scaleFactor;
  const hookSheet = Math.min(capH * 0.5, 0.35) * secTransform.scaleFactor;
  const rebarY = secBlk.bottom - coverSheet;
  const rebarLeftX = secBlk.left + coverSheet;
  const rebarRightX = secBlk.right - coverSheet;

  primitives.push(
    // Barra horizontal inferior
    {
      type: "line",
      x1: rebarLeftX,
      y1: rebarY,
      x2: rebarRightX,
      y2: rebarY,
      strokeWidth: 0.5,
      strokeColor: "#b30000",
    },
    // Gancho esquerdo
    {
      type: "line",
      x1: rebarLeftX,
      y1: rebarY,
      x2: rebarLeftX,
      y2: rebarY - hookSheet,
      strokeWidth: 0.5,
      strokeColor: "#b30000",
    },
    // Gancho direito
    {
      type: "line",
      x1: rebarRightX,
      y1: rebarY,
      x2: rebarRightX,
      y2: rebarY - hookSheet,
      strokeWidth: 0.5,
      strokeColor: "#b30000",
    },
  );

  // Cotas no Corte — afastadas do contorno para não cobrir armadura
  primitives.push(
    ...createLinearDimension({
      start: { x: secBlk.left, y: secBlk.top },
      end: { x: secBlk.left, y: secBlk.bottom },
      offset_mm: -10.0,
      measurement_cm: Math.round(capH * 100),
      orientation: "vertical",
      fontSize: 3.8,
    }),
  );

  const embedTop = secTransform.toSheetPoint({ x: -cap.width_m / 2, y: pileEmbed });
  const embedBot = secTransform.toSheetPoint({ x: -cap.width_m / 2, y: 0 });
  primitives.push(
    ...createLinearDimension({
      start: { x: secBlk.left, y: embedTop.y },
      end: { x: secBlk.left, y: embedBot.y },
      offset_mm: -16.0,
      measurement_cm: 10,
      orientation: "vertical",
      fontSize: 3.5,
    }),
  );

  primitives.push(
    ...createLinearDimension({
      start: { x: secBlk.left, y: secLean.bottom },
      end: { x: secBlk.right, y: secLean.bottom },
      offset_mm: 8.0,
      measurement_cm: Math.round(cap.width_m * 100),
      orientation: "horizontal",
      fontSize: 3.8,
    }),
  );

  // -------------------------------------------------------------
  // 4. COLUNA CENTRAL: DESDOBRAMENTO (x: 118 a 182)
  // -------------------------------------------------------------
  const rebarColBox = { x: 118, y: 10, width: 64, height: 140 };

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

  const rebarHeaderH = 5.5;
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
    text: fitTextToWidth("DESDOBRAMENTO", 5.0, rebarColBox.width - 4),
    x: rebarColBox.x + rebarColBox.width / 2,
    y: rebarColBox.y + rebarHeaderH / 2,
    fontSize: 5.0,
    align: "center",
    baseline: "middle",
    color: "#7A5820",
    bold: true,
  });

  // Extrai formas e desenha cada barra aberta
  const rebarShapes = extractRebarShapes(
    takeoff ?? {
      elementRef: titleInfo.elementRef,
      elementKind: "pile_cap",
      concreteGrade: "C30",
      concreteVolume_m3: 1,
      leanConcreteVolume_m3: 0.1,
      items: [],
      totalSteelWeight_kg: 0,
      totalSteelWithLosses_kg: 0,
      lossPercentage: 10,
      byDiameter: {},
    },
    {
      width_m: cap.width_m,
      length_m: cap.length_m,
      height_m: cap.thickness_m,
      cover_m: 0.05,
    },
  );

  const availableHeightForRebars = rebarColBox.height - rebarHeaderH - 4;
  const slotCount = Math.max(rebarShapes.length, 1);
  const slotH = Math.min(32, Math.max(22, availableHeightForRebars / slotCount));

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

      // Linha separadora suave entre slots
      if (idx < rebarShapes.length - 1) {
        primitives.push({
          type: "line",
          x1: rebarColBox.x + 4,
          y1: slotY + slotH - 1,
          x2: rebarColBox.x + rebarColBox.width - 4,
          y2: slotY + slotH - 1,
          strokeWidth: 0.2,
          strokeColor: "#e0e0e0",
        });
      }
    }
  });

  // -------------------------------------------------------------
  // 5. COLUNA DIREITA: TABELA + CARIMBO (sem invadir o desdobramento)
  // -------------------------------------------------------------
  if (takeoff) {
    const tableRes = drawRebarTable(takeoff, { x: 185, y: 10, width: 100, maxHeight: 135 });
    primitives.push(...tableRes.primitives);
  }

  const fullTitleInfo: TitleBlockInfo = {
    ...titleInfo,
    scaleLabel: "VER DET.",
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
