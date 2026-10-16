import type { CalculationMode, GoverningRule, MethodId } from '@engine/types'

/**
 * Configuração recomendada de métodos (DEC-58).
 *
 * O usuário comum nunca precisa abrir "Métodos": o projeto já nasce assim e a
 * etapa avançada oferece um botão para voltar a este estado.
 */
export interface MethodConfig {
  mode: CalculationMode
  governingRule: GoverningRule
  selectedMethod: MethodId
  aokiFs: number
  aokiPctTip: number
  aokiPctShaft: number
  decourtAlphaPct: number | null
  decourtBetaPct: number | null
  teixeiraFs: number
  teixeiraPctTip: number
  teixeiraPctShaft: number
}

export const RECOMMENDED_METHOD_CONFIG: MethodConfig = {
  mode: 'engineering',
  governingRule: 'minimum',
  selectedMethod: 'aoki_velloso',
  aokiFs: 2,
  aokiPctTip: 100,
  aokiPctShaft: 100,
  decourtAlphaPct: null,
  decourtBetaPct: null,
  teixeiraFs: 2,
  teixeiraPctTip: 100,
  teixeiraPctShaft: 100,
}

/** True quando a configuração atual é exatamente a recomendada. */
export function isRecommendedMethodConfig(c: MethodConfig): boolean {
  return (Object.keys(RECOMMENDED_METHOD_CONFIG) as (keyof MethodConfig)[]).every(
    (k) => c[k] === RECOMMENDED_METHOD_CONFIG[k],
  )
}
