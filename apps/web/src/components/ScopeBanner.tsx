import type { ReactNode } from 'react'

/** Banner de escopo MVP — só apresentação; sem cálculo. */
export function ScopeBanner({ children }: { children: ReactNode }) {
  return (
    <div className="scope-banner" role="status">
      {children}
    </div>
  )
}

export const SHALLOW_MVP_TEXT =
  'Escopo: pré-dimensionamento, sem cálculo de recalque. Confira os resultados — não substitui ART nem a análise do responsável técnico.'
