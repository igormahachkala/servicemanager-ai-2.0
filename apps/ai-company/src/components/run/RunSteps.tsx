import type { RunStep } from '../../domain/run/runStorage'
import { useI18n } from '../../i18n'

function stepStatusClass(status: RunStep['status']): string {
  if (status === 'done') return 'mcRunStepDone'
  if (status === 'active') return 'mcRunStepActive'
  if (status === 'failed') return 'mcRunStepFailed'
  if (status === 'skipped') return 'mcRunStepSkipped'
  return 'mcRunStepPending'
}

export function RunSteps({ steps }: { steps: RunStep[] }) {
  const { t } = useI18n()

  return (
    <ol className="mcRunSteps">
      {steps.map((step) => (
        <li key={step.id} className={`mcRunStep ${stepStatusClass(step.status)}`}>
          <div className="mcRunStepHead">
            <span className="mcRunStepOrder mcMono">{step.order}</span>
            <span className="mcRunStepLabel">{t.runEngine.steps[step.kind]}</span>
            <span className={`mcRunStepStatus mcMono ${stepStatusClass(step.status)}`}>
              {t.runEngine.stepStatuses[step.status]}
            </span>
          </div>
          {step.detail ? <div className="mcRunStepDetail mcMuted">{step.detail}</div> : null}
        </li>
      ))}
    </ol>
  )
}
