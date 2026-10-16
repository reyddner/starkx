import {
  STANDARD_SCALES,
  type Point2D,
  type SheetViewport,
  type StandardScale,
} from "./types";

export interface AutoScaleResult {
  /** Rótulo da escala. Normalmente uma escala ABNT; pode ser reduzida se nada couber. */
  scaleLabel: StandardScale | string;
  scaleFactor: number;
  scaleRatio: number; // Ex: 1000 / 20 = 50 mm por metro
  contentWidth_mm: number;
  contentHeight_mm: number;
}

export interface ModelDimensions {
  width_m: number;
  length_m?: number;
  height_m?: number;
  /** Centro do modelo no eixo horizontal (m). Default 0. */
  centerX_m?: number;
  /** Centro do modelo no eixo vertical (m). Cortes com base em y=0 usam H/2. */
  centerY_m?: number;
}

/**
 * Seleciona a maior escala padrão ABNT (mais ampliada) que caiba dentro do viewport disponível,
 * considerando uma margem de folga para cotas e anotações.
 */
export function selectBestScale(
  widthOrDim: number | ModelDimensions,
  heightOrViewport: number | SheetViewport,
  viewportOrMargin?: SheetViewport | number,
  marginRatio = 0.25, // 25% de folga para cotas externas
): AutoScaleResult {
  let modelWidth_m: number;
  let modelHeight_m: number;
  let viewport: SheetViewport;
  let margin = marginRatio;

  if (typeof widthOrDim === "object") {
    modelWidth_m = widthOrDim.width_m;
    modelHeight_m = widthOrDim.length_m ?? widthOrDim.height_m ?? widthOrDim.width_m;
    viewport = heightOrViewport as SheetViewport;
    if (typeof viewportOrMargin === "number") {
      margin = viewportOrMargin;
    }
  } else {
    modelWidth_m = widthOrDim;
    modelHeight_m = heightOrViewport as number;
    viewport = viewportOrMargin as SheetViewport;
  }

  const vWidth = viewport.width ?? (viewport as any).width_mm ?? 100;
  const vHeight = viewport.height ?? (viewport as any).height_mm ?? 100;

  const availableW = vWidth * (1 - margin);
  const availableH = vHeight * (1 - margin);

  const safeW_m = Math.max(0.1, modelWidth_m);
  const safeH_m = Math.max(0.1, modelHeight_m);

  // Procura da escala mais detalhada (1:10) para a mais reduzida (1:100)
  for (const s of STANDARD_SCALES) {
    const mmPerMeter = 1000 / s.factor;
    const w_mm = safeW_m * mmPerMeter;
    const h_mm = safeH_m * mmPerMeter;

    if (w_mm <= availableW && h_mm <= availableH) {
      return {
        scaleLabel: s.label,
        scaleFactor: s.factor,
        scaleRatio: mmPerMeter,
        contentWidth_mm: w_mm,
        contentHeight_mm: h_mm,
      };
    }
  }

  // Nenhuma escala padrão cabe: reduz de verdade para não estourar a caixa.
  // Preferimos desenho menor (com escala anotada) a desenho fora da folha.
  const fitRatio = Math.min(availableW / safeW_m, availableH / safeH_m);
  const requiredFactor = 1000 / fitRatio;
  const roundedFactor = Math.ceil(requiredFactor / 50) * 50;
  const mmPerMeter = 1000 / roundedFactor;
  return {
    scaleLabel: `1:${roundedFactor}`,
    scaleFactor: roundedFactor,
    scaleRatio: mmPerMeter,
    contentWidth_mm: safeW_m * mmPerMeter,
    contentHeight_mm: safeH_m * mmPerMeter,
  };
}

export interface TransformFunction {
  (p: Point2D): Point2D;
  toSheetPoint: (p: Point2D) => Point2D;
  scaleRatio: number;
  scaleFactor: number;
  originX: number;
  originY: number;
}

/**
 * Cria uma função de projeção que converte coordenadas em metros (modelo, Y para cima)
 * para milímetros de folha (Y para baixo), centralizando o elemento no viewport.
 */
export function createModelToSheetTransform(
  modelCenterOrDim: Point2D | ModelDimensions,
  scaleRatioOrViewport: number | SheetViewport,
  viewportOrScale?: SheetViewport | number | AutoScaleResult,
): TransformFunction {
  let modelCenter: Point2D;
  let scaleRatio: number;
  let viewport: SheetViewport;

  if (typeof scaleRatioOrViewport === "number") {
    modelCenter = modelCenterOrDim as Point2D;
    scaleRatio = scaleRatioOrViewport;
    viewport = viewportOrScale as SheetViewport;
  } else {
    // modelCenterOrDim is ModelDimensions, scaleRatioOrViewport is viewport, viewportOrScale is scaleFactor/AutoScaleResult
    const dims = modelCenterOrDim as ModelDimensions;
    modelCenter = { x: dims.centerX_m ?? 0, y: dims.centerY_m ?? 0 };
    viewport = scaleRatioOrViewport as SheetViewport;
    const scale = viewportOrScale;
    if (typeof scale === "number") {
      scaleRatio = 1000 / scale;
    } else if (typeof scale === "object" && scale != null && "scaleRatio" in scale) {
      scaleRatio = (scale as AutoScaleResult).scaleRatio;
    } else {
      scaleRatio = 50; // 1:20
    }
  }

  const viewCenterX = (viewport.x ?? 0) + (viewport.width ?? (viewport as any).width_mm) / 2;
  const viewCenterY = (viewport.y ?? 0) + (viewport.height ?? (viewport as any).height_mm) / 2;

  // Y do modelo cresce para cima; Y da folha cresce para baixo → inverte o sinal.
  const fn = ((p: Point2D): Point2D => ({
    x: viewCenterX + (p.x - modelCenter.x) * scaleRatio,
    y: viewCenterY - (p.y - modelCenter.y) * scaleRatio,
  })) as TransformFunction;

  fn.toSheetPoint = (p: Point2D) => fn(p);
  fn.scaleRatio = scaleRatio;
  fn.scaleFactor = scaleRatio;
  fn.originX = viewCenterX - modelCenter.x * scaleRatio;
  fn.originY = viewCenterY + modelCenter.y * scaleRatio;

  return fn;
}
