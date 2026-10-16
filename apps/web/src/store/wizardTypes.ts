export type FoundationKindUi = 'pile' | 'pile_cap' | 'footing' | 'caisson' | 'raft'

export type WizardStep =
  | 'project'
  | 'foundation'
  | 'analysis'
  | 'pile'
  | 'block'
  | 'footing'
  | 'caisson'
  | 'raft'
  | 'borehole'
  | 'groundwater'
  | 'loads'
  | 'methods'
  | 'results'
  | 'tip_sweep'
  | 'group'
  | 'rebar'
  | 'drawings'
  | 'memorial'

export interface LayerRow {
  depth_m: number
  nspt: number
  soilTypeId: number
  /** Descrição original da sondagem (texto livre). */
  description?: string
  /** Não considerar no atrito lateral (justificativa obrigatória se true). */
  excludeFromShaftFriction?: boolean
  excludeReason?: string
}
