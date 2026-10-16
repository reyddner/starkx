/**
 * Adapter: domínio paramétrico → DTO do motor geotécnico.
 * Nenhuma fórmula aqui — só mapeamento de unidades/campos.
 */

import type { Borehole, PileFoundation } from "../types";
import type {
  CalculationInput,
  CalculationMode,
  GoverningRule,
  MethodId,
} from "../../calculation-engine/types";

export interface GeotechAdapterOptions {
  mode?: CalculationMode;
  governingRule?: GoverningRule;
  selectedMethod?: MethodId;
  aoki?: CalculationInput["aoki"];
  decourt?: CalculationInput["decourt"];
  teixeira?: CalculationInput["teixeira"];
  methods?: CalculationInput["methods"];
  /** Profundidade do topo da estaca abaixo da cota 0 (m). */
  pileTopDepth_m?: number;
}

/**
 * Converte estaca + sondagem do domínio no input do calculation-engine.
 * Diâmetro no domínio está em metros; o motor espera cm.
 *
 * DEC-57: tipDepth_m no motor = comprimento L; cota SPT = pileTopDepth + L.
 * Domínio ainda pode guardar tipDepth_m como cota de ponta no SPT — neste caso
 * length_m é o comprimento e tipDepth_m a cota SPT; L = tip − pileTop.
 */
export function toGeotechnicalInput(
  pile: PileFoundation,
  borehole: Borehole,
  opts: GeotechAdapterOptions = {},
): CalculationInput {
  const pileTopDepth = Math.max(0, opts.pileTopDepth_m ?? 0);

  const layers = borehole.layers
    .map((layer) => {
      const depth_m = layer.bottomDepth_m;
      return {
        depth_m,
        nspt: layer.nspt,
        soilTypeId: layer.soilTypeId,
        excludeFromShaftFriction: layer.excludeFromShaftFriction === true,
      };
    })
    .filter((l) => l.depth_m > 0)
    .sort((a, b) => a.depth_m - b.depth_m);

  // Deduplicar por profundidade (última camada ganha)
  const byDepth = new Map<number, (typeof layers)[number]>();
  for (const l of layers) {
    // chave com precisão 1e-6
    const key = Math.round(l.depth_m * 1e6) / 1e6;
    byDepth.set(key, { ...l, depth_m: key });
  }

  // Domínio: tipDepth_m = cota SPT; length_m = L. Se iguais e pileTop=0, L = tip.
  const sptTip = pile.tipDepth_m;
  const lengthFromDomain = pile.length_m;
  let pileLength: number;
  if (Number.isFinite(lengthFromDomain) && lengthFromDomain > 0) {
    pileLength = lengthFromDomain;
  } else {
    pileLength = Math.max(0, sptTip - pileTopDepth);
  }

  return {
    pileTypeId: pile.pileTypeId,
    diameterCm: pile.diameter_m * 100,
    tipDepth_m: pileLength,
    pileTopDepth_m: pileTopDepth,
    areaCm2: pile.area_m2 != null ? pile.area_m2 * 1e4 : undefined,
    perimeterCm: pile.perimeter_m != null ? pile.perimeter_m * 100 : undefined,
    enlargedBaseVolumeLiters: pile.enlargedBaseVolumeLiters ?? undefined,
    layers: [...byDepth.values()],
    waterLevel_m: borehole.waterLevel_m,
    designLoad_kN: pile.designLoad_kN ?? null,
    mode: opts.mode,
    governingRule: opts.governingRule,
    selectedMethod: opts.selectedMethod,
    aoki: opts.aoki,
    decourt: opts.decourt,
    teixeira: opts.teixeira,
    methods: opts.methods,
  };
}
