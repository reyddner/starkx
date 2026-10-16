/**
 * Primitivas geométricas e tipos fundamentais para o motor de desenho executivo (drawing-engine).
 * Dimensões em folha são expressas em milímetros (mm).
 * Dimensões no modelo estrutural são expressas em metros (m).
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface Box2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export type StandardScale =
  | "1:10"
  | "1:15"
  | "1:20"
  | "1:25"
  | "1:33"
  | "1:40"
  | "1:50"
  | "1:75"
  | "1:100"
  | "1:125"
  | "1:150"
  | "1:200"
  | "1:250"
  | "1:500";

export const STANDARD_SCALES: { label: StandardScale; factor: number }[] = [
  { label: "1:10", factor: 10 },
  { label: "1:15", factor: 15 },
  { label: "1:20", factor: 20 },
  { label: "1:25", factor: 25 },
  { label: "1:33", factor: 33.333 },
  { label: "1:40", factor: 40 },
  { label: "1:50", factor: 50 },
  { label: "1:75", factor: 75 },
  { label: "1:100", factor: 100 },
  { label: "1:125", factor: 125 },
  { label: "1:150", factor: 150 },
  { label: "1:200", factor: 200 },
  { label: "1:250", factor: 250 },
  { label: "1:500", factor: 500 },
];

export interface LinePrimitive {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeWidth?: number;
  strokeColor?: string;
  dash?: number[];
  dashPattern?: number[];
}

export interface RectPrimitive {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  strokeWidth?: number;
  strokeColor?: string;
  fillColor?: string;
  rx?: number;
  dashPattern?: number[];
}

export interface CirclePrimitive {
  type: "circle";
  cx: number;
  cy: number;
  r: number;
  strokeWidth?: number;
  strokeColor?: string;
  fillColor?: string;
}

export interface TextPrimitive {
  type: "text";
  text: string;
  x: number;
  y: number;
  /** Tamanho em milímetros de folha (mesma unidade do viewBox). */
  fontSize: number;
  align?: "left" | "center" | "right";
  baseline?: "top" | "middle" | "bottom";
  color?: string;
  bold?: boolean;
}

export interface DimensionPrimitive {
  type: "dimension";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  text: string;
  offset_mm: number;
  tickSize_mm?: number;
}

export interface ImagePrimitive {
  type: "image";
  dataUri: string; // Base64 data URI ou URL
  x: number;
  y: number;
  width: number;
  height: number;
}

export type DrawingPrimitive =
  | LinePrimitive
  | RectPrimitive
  | CirclePrimitive
  | TextPrimitive
  | DimensionPrimitive
  | ImagePrimitive;

export interface SheetViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TitleBlockInfo {
  projectName: string;
  projectCode?: string;
  client?: string;
  location?: string;
  elementRef: string;
  drawingTitle: string;
  sheetNumber: number;
  totalSheets: number;
  scaleLabel: string;
  date: string;
  engineerName?: string;
  crea?: string;
  companyLogoBase64?: string;
}

export interface A4Sheet {
  sheetNumber: number;
  title: string;
  elementRef?: string;
  primitives: DrawingPrimitive[];
  titleBlock?: TitleBlockInfo;
  width_mm?: number;
  height_mm?: number;
}

export interface DrawingProjectBook {
  title?: string;
  projectName?: string;
  projectCode?: string;
  totalSheets: number;
  generatedAtIso?: string;
  sheets: A4Sheet[];
}
