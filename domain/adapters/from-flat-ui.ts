/**
 * Adapter auxiliar: estado flat da UI (Zustand) → CalculationInput
 * via domínio paramétrico + toGeotechnicalInput.
 * Sem fórmulas — só mapeamento de unidades/campos.
 */

import type { Borehole, PileFoundation } from "../types";
import type {
  CalculationInput,
  CalculationMode,
} from "../../calculation-engine/types";
import {
  toGeotechnicalInput,
  type GeotechAdapterOptions,
} from "./to-geotechnical-input";
import { depthsEqual } from "../pileDatum";

/** Snapshot mínimo do store para cálculo geotécnico de estaca. */
export interface FlatPileUiInput {
  pileTypeId: number;
  diameterCm: number;
  /** Comprimento L da estaca a partir do topo (m). */
  tipDepth_m: number;
  /** Profundidade do topo da estaca abaixo da cota 0 (m). Default 0. */
  pileTopDepth_m?: number;
  /** string da UI ou número; vazio = omitir */
  areaCm2?: number | string | null;
  perimeterCm?: number | string | null;
  enlargedBaseVolumeLiters?: number | string | null;
  waterLevel_m: number | null;
  layers: Array<{
    depth_m: number;
    nspt: number;
    soilTypeId: number;
    excludeFromShaftFriction?: boolean;
  }>;
  designLoad_kN: number | null;
}

function parseOptionalPositive(v: number | string | null | undefined): number | undefined {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

/**
 * Valida entradas da UI antes do adapter/motor.
 * Mensagens em pt-BR para calcError.
 */
export function validateFlatPileInput(
  flat: FlatPileUiInput,
  _mode: CalculationMode = "engineering",
): void {
  if (!Number.isFinite(flat.diameterCm) || flat.diameterCm <= 0) {
    throw new Error("Diâmetro deve ser > 0 cm.");
  }
  if (flat.diameterCm > 200) {
    throw new Error("Diâmetro > 200 cm — corrija o diâmetro.");
  }
  if (!Number.isFinite(flat.tipDepth_m) || flat.tipDepth_m < 1) {
    throw new Error("Comprimento da estaca deve ser ≥ 1 m.");
  }
  const pileTopDepth = Math.max(0, flat.pileTopDepth_m ?? 0);
  if (!Number.isFinite(pileTopDepth) || pileTopDepth < 0) {
    throw new Error("Profundidade do topo da estaca inválida.");
  }
  const sptTip = pileTopDepth + flat.tipDepth_m;

  if (!flat.layers.length) {
    throw new Error("Informe ao menos uma camada SPT.");
  }

  {
    const hasTip = flat.layers.some((l) => depthsEqual(l.depth_m, sptTip));
    if (!hasTip) {
      throw new Error(
        `Falta camada SPT na cota de apoio do perfil (${sptTip} m = topo ${pileTopDepth} + L ${flat.tipDepth_m}).`,
      );
    }
  }

  for (const layer of flat.layers) {
    if (!Number.isFinite(layer.nspt) || layer.nspt < 0) {
      throw new Error(`NSPT inválido na profundidade ${layer.depth_m} m.`);
    }
    if (!Number.isFinite(layer.soilTypeId) || layer.soilTypeId < 1) {
      throw new Error(`Tipo de solo inválido na profundidade ${layer.depth_m} m.`);
    }
  }
  if (flat.designLoad_kN != null && !(flat.designLoad_kN > 0)) {
    throw new Error("Carga de projeto, se informada, deve ser > 0 kN.");
  }
}

function validateMethodOpts(opts: GeotechAdapterOptions): void {
  if (opts.aoki?.fs != null && !(opts.aoki.fs > 0)) {
    throw new Error("FS Aoki-Velloso deve ser > 0.");
  }
  if (opts.teixeira?.fs != null && !(opts.teixeira.fs > 0)) {
    throw new Error("FS Teixeira deve ser > 0.");
  }
  for (const [label, pct] of [
    ["% ponta Aoki", opts.aoki?.pctTip],
    ["% fuste Aoki", opts.aoki?.pctShaft],
  ] as const) {
    if (pct != null && (!Number.isFinite(pct) || pct < 0 || pct > 100)) {
      throw new Error(`${label} deve estar entre 0 e 100.`);
    }
  }
}

/**
 * Monta Borehole + PileFoundation a partir do store flat e devolve CalculationInput.
 */
export function flatStoreToGeotechnicalInput(
  flat: FlatPileUiInput,
  opts: GeotechAdapterOptions = {},
): CalculationInput {
  const mode = opts.mode ?? "engineering";
  validateFlatPileInput(flat, mode);
  validateMethodOpts(opts);

  const areaCm2 = parseOptionalPositive(flat.areaCm2);
  const perimeterCm = parseOptionalPositive(flat.perimeterCm);
  const volumeL = parseOptionalPositive(flat.enlargedBaseVolumeLiters);
  const pileTopDepth = Math.max(0, flat.pileTopDepth_m ?? 0);
  const sptTip = pileTopDepth + flat.tipDepth_m;

  const borehole: Borehole = {
    id: "ui-borehole",
    label: "SPT (UI)",
    waterLevel_m: flat.waterLevel_m,
    source: "manual",
    layers: flat.layers.map((l, i, arr) => {
      const prev = i === 0 ? 0 : arr[i - 1]!.depth_m;
      return {
        topDepth_m: prev,
        bottomDepth_m: l.depth_m,
        nspt: l.nspt,
        soilTypeId: l.soilTypeId,
        excludeFromShaftFriction: l.excludeFromShaftFriction === true,
      };
    }),
  };

  const pile: PileFoundation = {
    id: "ui-pile",
    kind: "pile",
    label: "E1",
    boreholeId: "ui-borehole",
    pileTypeId: flat.pileTypeId,
    diameter_m: flat.diameterCm / 100,
    length_m: flat.tipDepth_m,
    tipDepth_m: sptTip,
    position: { x_m: 0, y_m: 0 },
    designLoad_kN: flat.designLoad_kN,
    area_m2: areaCm2 != null ? areaCm2 / 1e4 : null,
    perimeter_m: perimeterCm != null ? perimeterCm / 100 : null,
    enlargedBaseVolumeLiters: volumeL ?? null,
  };

  const input = toGeotechnicalInput(pile, borehole, opts);
  // tipDepth_m no motor = L; pileTopDepth_m desloca a cota SPT
  input.tipDepth_m = flat.tipDepth_m;
  input.pileTopDepth_m = pileTopDepth;
  return input;
}
