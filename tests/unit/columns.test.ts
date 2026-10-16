import { describe, expect, it } from 'vitest'
import {
  createColumn,
  emptyColumnLoad,
  ensureColumnsFromLegacy,
  nextColumnLabel,
  upsertColumn,
} from '../../apps/web/src/store/columns'
import { classifyPatchKeys, patchTouchesLoads } from '../../apps/web/src/store/patchPolicy'

describe('columns (DEC-44)', () => {
  it('gera rótulos P01, P02… sem colidir', () => {
    const a = createColumn({ columnLabel: 'P01' })
    expect(nextColumnLabel([a])).toBe('P02')
    const b = createColumn({}, [a])
    expect(b.columnLabel).toBe('P02')
  })

  it('upsert atualiza só o id alvo', () => {
    const a = createColumn({ columnLabel: 'P01', N_kN: 100 })
    const b = createColumn({ columnLabel: 'P02', N_kN: 200 }, [a])
    const next = upsertColumn([a, b], a.id, { N_kN: 150, Mx_kNm: 10 })
    expect(next.find((c) => c.id === a.id)?.N_kN).toBe(150)
    expect(next.find((c) => c.id === a.id)?.Mx_kNm).toBe(10)
    expect(next.find((c) => c.id === b.id)?.N_kN).toBe(200)
  })

  it('migrate legado: columnLoad vira columns[0]', () => {
    const load = { ...emptyColumnLoad(), N_kN: 180, columnLabel: 'P03' }
    const m = ensureColumnsFromLegacy(load, null, null)
    expect(m.columns).toHaveLength(1)
    expect(m.columns[0]!.columnLabel).toBe('P03')
    expect(m.columns[0]!.N_kN).toBe(180)
    expect(m.activeColumnId).toBe(m.columns[0]!.id)
  })

  it('migrate preserva columns existentes e corrige active inválido', () => {
    const a = createColumn({ columnLabel: 'P01' })
    const b = createColumn({ columnLabel: 'P02' }, [a])
    const m = ensureColumnsFromLegacy(emptyColumnLoad(), [a, b], 'id-inexistente')
    expect(m.columns).toHaveLength(2)
    expect(m.activeColumnId).toBe(a.id)
  })

  it('patch de columns/activeColumnId preserva Padm', () => {
    expect(classifyPatchKeys(['columns', 'activeColumnId'])).toBe('keep_padm')
    expect(patchTouchesLoads(['activeColumnId'])).toBe(true)
  })
})
