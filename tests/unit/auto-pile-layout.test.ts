import { beforeEach, describe, expect, it } from 'vitest'
import { useProjectStore } from '../../apps/web/src/store/projectStore'

describe('arranjo automático de estacas (N > Padm)', () => {
  beforeEach(() => {
    useProjectStore.getState().resetBlankProject()
  })

  it('com carga grande sobe automaticamente para bloco com várias estacas', () => {
    const store = useProjectStore.getState()
    store.loadReferenceExample()

    // O exemplo tem Padm da ordem de 200 kN; carga enorme exige grupo.
    useProjectStore.getState().patch({
      designLoad_kN: 2500,
      columnLoad: {
        ...useProjectStore.getState().columnLoad,
        N_kN: 2500,
        Mx_kNm: 0,
        My_kNm: 0,
      },
    })

    useProjectStore.getState().runCalculation({ preserveStep: true })

    const s = useProjectStore.getState()
    expect(s.result).not.toBeNull()
    expect(s.calcError).toBeNull()
    expect(s.foundationKind).toBe('pile_cap')
    expect(s.blockRows * s.blockCols).toBeGreaterThanOrEqual(2)
    expect(s.groupResult).not.toBeNull()
    expect(s.blockResult).not.toBeNull()
    expect(s.blockResult!.pileCount).toBeGreaterThanOrEqual(2)
  })

  it('estaca isolada com carga coberta por 1 estaca permanece 1×1, sem bloco', () => {
    const store = useProjectStore.getState()
    store.loadReferenceExample()

    useProjectStore.getState().patch({
      designLoad_kN: 50,
      columnLoad: {
        ...useProjectStore.getState().columnLoad,
        N_kN: 50,
        Mx_kNm: 0,
        My_kNm: 0,
      },
    })

    useProjectStore.getState().runCalculation({ preserveStep: true })

    const s = useProjectStore.getState()
    expect(s.result).not.toBeNull()
    expect(s.mode).toBe('engineering')
    expect(s.foundationKind).toBe('pile')
    expect(s.blockRows * s.blockCols).toBe(1)
    expect(s.blockResult).toBeNull()
  })
})
