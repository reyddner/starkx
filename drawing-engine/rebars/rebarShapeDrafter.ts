import type {
  DrawingPrimitive,
  RectPrimitive,
  CirclePrimitive,
  TextPrimitive,
} from "../core/types";
import type { RebarShapeDefinition } from "./types";

export interface DrawRebarSlotOptions {
  slotX: number;
  slotY: number;
  slotW: number;
  slotH: number;
  rebar: RebarShapeDefinition;
}

/**
 * Desenha o esquema da barra aberta (desdobrada) com as medidas de cada dobra
 * e a anotação padrão da norma (Ex.: "2 N1 Ø10 C=274").
 */
export function drawRebarShape(
  optsOrRebar: DrawRebarSlotOptions | RebarShapeDefinition,
  box?: { x: number; y: number; width: number; height: number },
): DrawingPrimitive[] {
  let slotX: number;
  let slotY: number;
  let slotW: number;
  let slotH: number;
  let rebar: RebarShapeDefinition;

  if (box) {
    rebar = optsOrRebar as RebarShapeDefinition;
    slotX = box.x;
    slotY = box.y;
    slotW = box.width;
    slotH = box.height;
  } else {
    const opts = optsOrRebar as DrawRebarSlotOptions;
    slotX = opts.slotX;
    slotY = opts.slotY;
    slotW = opts.slotW;
    slotH = opts.slotH;
    rebar = opts.rebar;
  }

  const primitives: DrawingPrimitive[] = [];

  const kind = rebar.shapeKind ?? rebar.kind ?? "straight";
  const mainColor = "#7A5820"; // Azul escuro técnico estrutural
  const dimColor = "#222222";
  const strokeW = 0.9;

  // Área útil de desenho da barra (deixando espaço inferior para o texto N Ø C)
  const drawW = slotW - 12;
  const drawH = slotH - 10;
  const cx = slotX + drawW / 2 + 4;
  const cy = slotY + drawH / 2 + 1;

  if (kind === "closed_rect") {
    // Estribo retangular fechado com gancho
    const legA = rebar.legs_cm[0] ?? 80;
    const legB = rebar.legs_cm[1] ?? 40;
    const hook = rebar.legs_cm[2] ?? 10;

    const maxLeg = Math.max(legA, legB);
    const rw = Math.min(drawW * 0.7, (legA / maxLeg) * (drawW * 0.7));
    const rh = Math.min(drawH * 0.7, (legB / maxLeg) * (drawH * 0.7));
    const rx = cx - rw / 2;
    const ry = cy - rh / 2;

    const rect: RectPrimitive = {
      type: "rect",
      x: rx,
      y: ry,
      width: rw,
      height: rh,
      strokeWidth: strokeW,
      strokeColor: mainColor,
      rx: 1.0,
    };
    primitives.push(rect);

    // Gancho interno esquemático
    primitives.push({
      type: "line",
      x1: rx,
      y1: ry + 3,
      x2: rx + 4,
      y2: ry + 7,
      strokeWidth: strokeW,
      strokeColor: mainColor,
    });

    // Cotas dos lados
    primitives.push({
      type: "text",
      text: `${Math.round(legA)}`,
      x: rx + rw / 2,
      y: ry - 2.5,
      fontSize: 4.5,
      align: "center",
      baseline: "bottom",
      color: dimColor,
      bold: true,
    });
    primitives.push({
      type: "text",
      text: `${Math.round(legB)}`,
      x: rx + rw + 2.5,
      y: ry + rh / 2,
      fontSize: 4.5,
      align: "left",
      baseline: "middle",
      color: dimColor,
      bold: true,
    });
    primitives.push({
      type: "text",
      text: `(${Math.round(hook)})`,
      x: rx + 6,
      y: ry + 6,
      fontSize: 4.0,
      align: "left",
      baseline: "top",
      color: "#555555",
    });
  } else if (kind === "circular_ring") {
    // Estribo circular com gancho
    const dia_cm = rebar.legs_cm[0] ?? 40;
    const r_mm = Math.min(drawW, drawH) * 0.35;

    const circ: CirclePrimitive = {
      type: "circle",
      cx,
      cy,
      r: r_mm,
      strokeWidth: strokeW,
      strokeColor: mainColor,
    };
    primitives.push(circ);

    // Cota diâmetro
    primitives.push({
      type: "text",
      text: `Ø ${Math.round(dia_cm)}`,
      x: cx,
      y: cy,
      fontSize: 4.5,
      align: "center",
      baseline: "middle",
      color: dimColor,
      bold: true,
    });
  } else if (kind === "u_shape") {
    // Barra em U (gancho - vão - gancho)
    const hookA = rebar.legs_cm[0] ?? 20;
    const span = rebar.legs_cm[1] ?? 80;
    const hookB = rebar.legs_cm[2] ?? 20;

    const w_mm = drawW * 0.75;
    const h_mm = Math.min(drawH * 0.45, w_mm * (hookA / span));
    const bx = cx - w_mm / 2;
    const by = cy + h_mm / 2;

    primitives.push(
      { type: "line", x1: bx, y1: by - h_mm, x2: bx, y2: by, strokeWidth: strokeW, strokeColor: mainColor },
      { type: "line", x1: bx, y1: by, x2: bx + w_mm, y2: by, strokeWidth: strokeW, strokeColor: mainColor },
      { type: "line", x1: bx + w_mm, y1: by, x2: bx + w_mm, y2: by - h_mm, strokeWidth: strokeW, strokeColor: mainColor },
    );

    // Cotas
    primitives.push({
      type: "text",
      text: `${Math.round(span)}`,
      x: cx,
      y: by + 2.5,
      fontSize: 4.5,
      align: "center",
      baseline: "top",
      color: dimColor,
      bold: true,
    });
    primitives.push({
      type: "text",
      text: `${Math.round(hookA)}`,
      x: bx - 2.5,
      y: by - h_mm / 2,
      fontSize: 4.5,
      align: "right",
      baseline: "middle",
      color: dimColor,
      bold: true,
    });
    primitives.push({
      type: "text",
      text: `${Math.round(hookB)}`,
      x: bx + w_mm + 2.5,
      y: by - h_mm / 2,
      fontSize: 4.5,
      align: "left",
      baseline: "middle",
      color: dimColor,
      bold: true,
    });
  } else if (kind === "l_shape") {
    // Barra em L (haste reta + gancho)
    const stem = rebar.legs_cm[0] ?? 100;
    const hook = rebar.legs_cm[1] ?? 30;

    const w_mm = drawW * 0.75;
    const h_mm = Math.min(drawH * 0.4, w_mm * 0.35);
    const bx = cx - w_mm / 2;
    const by = cy;

    primitives.push(
      { type: "line", x1: bx, y1: by, x2: bx + w_mm, y2: by, strokeWidth: strokeW, strokeColor: mainColor },
      { type: "line", x1: bx + w_mm, y1: by, x2: bx + w_mm, y2: by - h_mm, strokeWidth: strokeW, strokeColor: mainColor },
    );

    primitives.push({
      type: "text",
      text: `${Math.round(stem)}`,
      x: cx,
      y: by + 2.5,
      fontSize: 4.5,
      align: "center",
      baseline: "top",
      color: dimColor,
      bold: true,
    });
    primitives.push({
      type: "text",
      text: `${Math.round(hook)}`,
      x: bx + w_mm + 2.5,
      y: by - h_mm / 2,
      fontSize: 4.5,
      align: "left",
      baseline: "middle",
      color: dimColor,
      bold: true,
    });
  } else {
    // Barra reta ou diagonal
    const len_cm = rebar.totalLength_cm;
    const w_mm = drawW * 0.8;
    const bx = cx - w_mm / 2;

    primitives.push({
      type: "line",
      x1: bx,
      y1: cy,
      x2: bx + w_mm,
      y2: cy,
      strokeWidth: strokeW,
      strokeColor: mainColor,
    });

    primitives.push({
      type: "text",
      text: `${Math.round(len_cm ?? 100)}`,
      x: cx,
      y: cy - 2.5,
      fontSize: 4.5,
      align: "center",
      baseline: "bottom",
      color: dimColor,
      bold: true,
    });
  }

  // Linha de texto com a legenda oficial: Ex.: "2 N1 Ø10 C=274"
  const totalLen = rebar.totalLength_cm ?? rebar.unitLength_cm ?? Math.round((rebar.totalLength_m ?? 1) * 100);
  const spacingText = rebar.spacing_cm ? ` c/${Math.round(rebar.spacing_cm)}` : "";
  const diaText = rebar.diameter_mm % 1 === 0 ? rebar.diameter_mm.toFixed(0) : rebar.diameter_mm.toFixed(1);
  const tagText = `${rebar.count} N${rebar.posNumber} Ø${diaText}${spacingText} C=${Math.round(totalLen)}`;

  const tag: TextPrimitive = {
    type: "text",
    text: tagText,
    x: cx,
    y: slotY + slotH - 1.5,
    fontSize: 4.8,
    align: "center",
    baseline: "bottom",
    color: "#000000",
    bold: true,
  };
  primitives.push(tag);

  return primitives;
}
