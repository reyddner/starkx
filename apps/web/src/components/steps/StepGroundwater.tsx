import { useProjectStore } from '../../store/projectStore'
import { FlowNavButtons } from '../FlowNavButtons'
import { GroundwaterFields } from './GroundwaterFields'

/**
 * Tela dedicada ao NA mantida apenas como destino de links antigos (DEC-58).
 * O caminho principal edita o NA dentro da Sondagem.
 */
export function StepGroundwater() {
  const setStep = useProjectStore((s) => s.setStep)

  return (
    <section className="panel" data-testid="step-groundwater">
      <h2>Nível d&apos;água</h2>
      <p className="lead">
        Este campo agora faz parte da etapa <strong>Sondagem e nível d&apos;água</strong>. Você pode
        editar aqui ou voltar para a sondagem.
      </p>
      <GroundwaterFields />
      <FlowNavButtons
        primaryLabel="Voltar à sondagem"
        onPrimary={() => {
          setStep('borehole')
          return false
        }}
      />
    </section>
  )
}
