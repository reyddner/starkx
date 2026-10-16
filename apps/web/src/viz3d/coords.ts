import type { LayerRow } from '../store/projectStore'
import { soilColorHex as soilColorHexShared } from '../viz/soilVisual'

export interface SoilSlice {
  top_m: number
  bottom_m: number
  soilTypeId: number
  nspt: number
}

/** Converte camadas do store (depth = base da fatia) em intervalos [top, bottom]. */
export function layersToSlices(layers: LayerRow[]): SoilSlice[] {
  const sorted = [...layers].sort((a, b) => a.depth_m - b.depth_m)
  return sorted.map((layer, i) => ({
    top_m: i === 0 ? 0 : sorted[i - 1]!.depth_m,
    bottom_m: layer.depth_m,
    soilTypeId: layer.soilTypeId,
    nspt: layer.nspt,
  }))
}

/** Reexport — fonte única em `viz/soilVisual.ts` (DEC-33). */
export const soilColorHex = soilColorHexShared

export function pileColorHex(theme: 'light' | 'dark'): string {
  return theme === 'dark' ? '#9ca3af' : '#6b7280'
}

export function concreteColorHex(theme: 'light' | 'dark'): string {
  return theme === 'dark' ? '#8b939e' : '#a8b0ba'
}

export function waterColorHex(): string {
  return '#0284c7'
}

/**
 * Raio Franki — mesma fórmula do calculation-engine (DEC-33).
 * Import local evita acoplar Three ao path de teste do motor via apps/web.
 */
export { frankiSphereRadius_m } from '@engine/piles/geometry'
