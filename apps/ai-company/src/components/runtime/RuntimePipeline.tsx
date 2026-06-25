import type { RuntimePipelineStep } from '../../domain/runtime/runtimeOrchestrator'
import { useI18n } from '../../i18n'

export function RuntimePipeline({ steps }: { steps: RuntimePipelineStep[] }) {
  const { t } = useI18n()

  return (
    <ol className="mcRuntimePipeline">
      {steps.map((step) => (
        <li
          key={step.id}
          className={`mcRuntimePipelineStep mcRuntimePipelineStep${capitalize(step.status)}`}
        >
          <div className="mcRuntimePipelineStepHead">
            <span className="mcRuntimePipelineOrder mcMono">{step.order}</span>
            <strong>{t.runtimeOrchestrator.pipelineSteps[step.id as keyof typeof t.runtimeOrchestrator.pipelineSteps]}</strong>
            <span className="mcRuntimePipelineStatus">
              {t.runtimeOrchestrator.pipelineStatus[step.status]}
            </span>
          </div>
          {step.detail ? <div className="mcRuntimePipelineDetail mcMuted">{step.detail}</div> : null}
        </li>
      ))}
    </ol>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
