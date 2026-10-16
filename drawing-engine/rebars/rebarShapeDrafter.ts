import type {
  DrawingPrimitive,
  RectPrimitive,
  CirclePrimitive,
  TextPrimitive,
} from "../core/types";
import type { RebarShapeDefinition } from "./types";
import {
  estimateTextWidthMm,
  fitFontSize,
  fitTextToWidth,
  MIN_FONT_MM,
  TEXT_METRICS,
} from "../core/textFit";

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
  const mainColor = "#7A5820";
  const dimColor = "#222222";
  const strokeW = 0.9;
  const dimFs = 4.2;
  const dimH = dimFs * TEXT_METRICS.capHeight;

  // Faixa de baixo: legenda "N Ø C". O resto é a área da barra + cotas.
  const tagFs = fitFontSize(tagTextOf(rebar), 4.8, slotW - 2);
  const tagBand = tagFs + 2.5;
  const area = { x: slotX, y: slotY + 1, w: slotW, h: Math.max(6, slotH - 1 - tagBand) };
  const cx = area.x + area.w / 2;
  const label = (v: number) => `${Math.round(v)}`;
  const labelW = (v: number) => estimateTextWidthMm(label(v), dimFs, true);
  const dimText = (
    text: string,
    x: number,
    y: number,
    align: TextPrimitive["align"],
    baseline: TextPrimitive["baseline"],
  ): TextPrimitive => ({ type: "text", text, x, y, fontSize: dimFs, align, baseline, color: dimColor, bold: true });

  if (kind === "closed_rect") {
    // Estribo retangular fechado: cota de A em cima, de B à direita.
    const legA = rebar.legs_cm[0] ?? 80;
    const legB = rebar.legs_cm[1] ?? 40;
    const top = area.y + dimH + 2;
    const availH = Math.max(3, area.y + area.h - top);
    const side = labelW(legB) + 3;
    const availW = Math.max(6, area.w - 2 * side - 2);
    const k = Math.min(availW / Math.max(legA, 1), availH / Math.max(legB, 1));
    const rw = Math.max(4, legA * k);
    const rh = Math.max(3, legB * k);
    const rx = cx - rw / 2;
    const ry = top + (availH - rh) / 2;

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
    // Gancho esquemático no canto superior esquerdo.
    const hookLeg = Math.min(4, rh * 0.45, rw * 0.3);
    primitives.push({
      type: "line",
      x1: rx,
      y1: ry + hookLeg * 0.4,
      x2: rx + hookLeg,
      y2: ry + hookLeg * 1.4,
      strokeWidth: strokeW,
      strokeColor: mainColor,
    });
    primitives.push(dimText(label(legA), rx + rw / 2, ry - 1.5, "center", "bottom"));
    primitives.push(dimText(label(legB), rx + rw + 2.5, ry + rh / 2, "left", "middle"));
    // Gancho (cm) só quando cabe dentro do estribo sem tocar o traço.
    const hook = rebar.legs_cm[2];
    if (hook != null) {
      const hookText = `(${Math.round(hook)})`;
      const fs = MIN_FONT_MM;
      if (rh >= fs * 1.6 + 2 && rw >= estimateTextWidthMm(hookText, fs, false) + hookLeg + 4) {
        primitives.push({
          type: "text",
          text: hookText,
          x: rx + hookLeg + 2,
          y: ry + rh / 2,
          fontSize: fs,
          align: "left",
          baseline: "middle",
          color: "#555555",
        });
      }
    }
  } else if (kind === "circular_ring") {
    const dia_cm = rebar.legs_cm[0] ?? 40;
    const r_mm = Math.max(3, Math.min(area.w, area.h) / 2 - 1);
    const cy = area.y + area.h / 2;
    const circ: CirclePrimitive = {
      type: "circle",
      cx,
      cy,
      r: r_mm,
      strokeWidth: strokeW,
      strokeColor: mainColor,
    };
    primitives.push(circ);
    const text = `Ø ${Math.round(dia_cm)}`;
    const inside = estimateTextWidthMm(text, dimFs, true) <= r_mm * 1.6;
    primitives.push(
      inside
        ? dimText(text, cx, cy, "center", "middle")
        : dimText(text, cx + r_mm + 2, cy, "left", "middle"),
    );
  } else if (kind === "u_shape" || kind === "l_shape") {
    // U: gancho – vão – gancho; L: vão – gancho. Vão cotado embaixo, ganchos ao lado.
    const isU = kind === "u_shape";
    const span = (isU ? rebar.legs_cm[1] : rebar.legs_cm[0]) ?? 80;
    const hookR = (isU ? rebar.legs_cm[2] : rebar.legs_cm[1]) ?? 20;
    const hookL = isU ? (rebar.legs_cm[0] ?? 20) : 0;
    const sideL = isU ? labelW(hookL) + 3 : 2;
    const sideR = labelW(hookR) + 3;
    const w_mm = Math.max(8, area.w - sideL - sideR - 2);
    const by = area.y + area.h - dimH - 2.5;
    const h_mm = Math.max(2.5, Math.min(by - area.y - 1, w_mm * (Math.max(hookL, hookR) / Math.max(span, 1))));
    const bx = area.x + sideL + 1 + (area.w - sideL - sideR - 2 - w_mm) / 2;

    primitives.push({ type: "line", x1: bx, y1: by, x2: bx + w_mm, y2: by, strokeWidth: strokeW, strokeColor: mainColor });
    primitives.push({ type: "line", x1: bx + w_mm, y1: by, x2: bx + w_mm, y2: by - h_mm, strokeWidth: strokeW, strokeColor: mainColor });
    if (isU) {
      primitives.push({ type: "line", x1: bx, y1: by - h_mm, x2: bx, y2: by, strokeWidth: strokeW, strokeColor: mainColor });
      primitives.push(dimText(label(hookL), bx - 2.5, by - h_mm / 2, "right", "middle"));
    }
    primitives.push(dimText(label(hookR), bx + w_mm + 2.5, by - h_mm / 2, "left", "middle"));
    primitives.push(dimText(label(span), bx + w_mm / 2, by + 1.5, "center", "top"));
  } else {
    // Barra reta (ou diagonal desenhada reta): comprimento em cima da barra.
    const len_cm = rebar.legs_cm[0] ?? rebar.unitLength_cm ?? rebar.totalLength_cm ?? 100;
    const w_mm = area.w * 0.8;
    const bx = cx - w_mm / 2;
    const y = area.y + Math.min(area.h, dimH + 2 + (area.h - dimH - 2) / 2);
    primitives.push({
      type: "line",
      x1: bx,
      y1: y,
      x2: bx + w_mm,
      y2: y,
      strokeWidth: strokeW,
      strokeColor: mainColor,
    });
    primitives.push(dimText(label(len_cm), cx, y - 1.5, "center", "bottom"));
  }

  // Legenda oficial: Ex.: "2 N1 Ø10 C=274"
  const tag: TextPrimitive = {
    type: "text",
    text: fitTextToWidth(tagTextOf(rebar), tagFs, slotW - 2),
    x: cx,
    y: slotY + slotH - 1.5,
    fontSize: tagFs,
    align: "center",
    baseline: "bottom",
    color: "#000000",
    bold: true,
  };
  primitives.push(tag);

  return primitives;
}

function tagTextOf(rebar: RebarShapeDefinition): string {
  const totalLen =
    rebar.totalLength_cm ?? rebar.unitLength_cm ?? Math.round((rebar.totalLength_m ?? 1) * 100);
  const spacingText = rebar.spacing_cm ? ` c/${Math.round(rebar.spacing_cm)}` : "";
  const diaText =
    rebar.diameter_mm % 1 === 0 ? rebar.diameter_mm.toFixed(0) : rebar.diameter_mm.toFixed(1);
  return `${rebar.count} N${rebar.posNumber} Ø${diaText}${spacingText} C=${Math.round(totalLen)}`;
}
