import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n'
import type { MobileDemoChecklistView, MobileDemoStepView } from '../demo/mobileDemoViewModel'

type Props = {
  checklist: MobileDemoChecklistView
  compact?: boolean
}

function StepRow({ step, compact }: { step: MobileDemoStepView; compact?: boolean }) {
  const { t } = useI18n()
  const copy = t.mobile.demo

  return (
    <li
      className={`acMobileDemoStep acMobileDemoStep--${step.status}${compact ? ' acMobileDemoStepCompact' : ''}`}
      aria-current={step.status === 'current' ? 'step' : undefined}
    >
      <div className="acMobileDemoStepHead">
        <span className="acMobileDemoStepIndex" aria-hidden>
          {step.order}
        </span>
        <div className="acMobileDemoStepText">
          <span className="acMobileDemoStepTitle">{copy.steps[step.id].title}</span>
          <span className={`acMobileDemoStepStatus acMobileDemoStepStatus--${step.status}`}>
            {copy.stepStatus[step.status]}
          </span>
        </div>
      </div>
      {!compact ? (
        <p className="acMobileDemoStepHint">{copy.steps[step.id].hint}</p>
      ) : null}
      {step.detail ? <p className="acMobileDemoStepDetail">{step.detail}</p> : null}
      {step.status !== 'completed' ? (
        <Link
          to={step.href}
          className={step.status === 'current' ? 'acMobilePrimaryBtn acMobileDemoStepAction' : 'acMobileSecondaryBtn acMobileDemoStepAction'}
        >
          {copy.steps[step.id].action}
        </Link>
      ) : null}
    </li>
  )
}

export function MobileDemoChecklist({ checklist, compact = false }: Props) {
  const { t } = useI18n()
  const copy = t.mobile.demo

  return (
    <section className="acMobileDemoChecklist" aria-label={copy.checklistAria}>
      <div className="acMobileDemoProgressHead">
        <span>{copy.progress}</span>
        <span>
          {checklist.completedCount}/{checklist.totalCount} · {checklist.progressPercent}%
        </span>
      </div>
      <div
        className="acMobileDemoProgressTrack"
        role="progressbar"
        aria-valuenow={checklist.progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="acMobileDemoProgressFill"
          style={{ width: `${checklist.progressPercent}%` }}
        />
      </div>
      <ol className="acMobileDemoStepList">
        {checklist.steps.map((step) => (
          <StepRow key={step.id} step={step} compact={compact} />
        ))}
      </ol>
      {checklist.isComplete ? (
        <p className="acMobileDemoCompleteNote">{copy.completeNote}</p>
      ) : null}
    </section>
  )
}
