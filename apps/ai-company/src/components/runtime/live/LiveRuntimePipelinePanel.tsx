import type { RuntimePipelineStep } from '../../../domain/runtime/runtimeOrchestrator'
import { resolveCurrentPipelineStep } from '../../../hooks/useLiveRuntimeMonitor'
import { useI18n } from '../../../i18n'

type Props = {
  steps: RuntimePipelineStep[]
  currentStep: RuntimePipelineStep | null
}

export function LiveRuntimePipelinePanel({ steps, currentStep }: Props) {
  const { t } = useI18n()
  const activeStep = currentStep ?? resolveCurrentPipelineStep(steps)

  return (
    <div className="mcLiveRuntimePipeline">
      {activeStep ? (
        <div className="mcLiveRuntimeCurrentStep">
          <span className="mcFieldLabel">{t.runtimeLive.currentStep}</span>
          <strong>
            {stepLabel(t, activeStep.id)} · {t.runtimeOrchestrator.pipelineStatus[activeStep.status]}
          </strong>
          {activeStep.detail ? <p className="mcMuted">{activeStep.detail}</p> : null}
        </div>
      ) : null}
      <ol className="mcRuntimePipeline mcLiveRuntimePipelineList">
        {steps.map((step) => {
          const isCurrent = activeStep?.id === step.id
          return (
            <li
              key={step.id}
              className={`mcRuntimePipelineStep mcRuntimePipelineStep${capitalize(step.status)}${isCurrent ? ' mcLiveRuntimePipelineStepCurrent' : ''}`}
            >
              <div className="mcRuntimePipelineStepHead">
                <span className="mcRuntimePipelineOrder mcMono">{step.order}</span>
                <strong>{stepLabel(t, step.id)}</strong>
                <span className="mcRuntimePipelineStatus">
                  {t.runtimeOrchestrator.pipelineStatus[step.status]}
                </span>
              </div>
              {step.detail ? <div className="mcRuntimePipelineDetail mcMuted">{step.detail}</div> : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function stepLabel(
  t: ReturnType<typeof useI18n>['t'],
  stepId: string,
): string {
  const steps = t.runtimeOrchestrator.pipelineSteps as Record<string, string>
  return steps[stepId] ?? stepId
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
