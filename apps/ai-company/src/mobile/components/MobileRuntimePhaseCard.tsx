import { useI18n } from '../../i18n'
import type { MobileRuntimeLiveStepView } from '../runtime/mobileRuntimeLiveViewModel'

type MobileRuntimePhaseCardProps = {
  step: MobileRuntimeLiveStepView
  index: number
  isCurrent: boolean
}

function formatDuration(ms: number | null): string | null {
  if (ms == null || ms <= 0) return null
  if (ms < 1000) return `${ms} ms`
  return `${Math.round(ms / 1000)} с`
}

function formatWhen(iso: string | null): string | null {
  if (!iso) return null
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export function MobileRuntimePhaseCard({ step, index, isCurrent }: MobileRuntimePhaseCardProps) {
  const { t } = useI18n()
  const copy = t.mobile.runtimeLive
  const label = copy.steps[step.id]
  const statusLabel = copy.phaseStatus[step.status]
  const completedAt = formatWhen(step.completedAt)
  const duration = formatDuration(step.durationMs)

  return (
    <li
      className={
        isCurrent
          ? 'acMobileRuntimePhaseCard acMobileRuntimePhaseCardCurrent'
          : 'acMobileRuntimePhaseCard'
      }
    >
      <div className="acMobileRuntimePhaseHead">
        <span className="acMobileRuntimePhaseIndex" aria-hidden>
          {index + 1}
        </span>
        <div className="acMobileRuntimePhaseTitles">
          <h3 className="acMobileRuntimePhaseTitle">{label}</h3>
          <span className={`acMobileRuntimePhaseStatus acMobileRuntimePhaseStatus--${step.status}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      {step.detail ? <p className="acMobileRuntimePhaseDetail">{step.detail}</p> : null}

      <dl className="acMobileRuntimePhaseMeta">
        {step.modelLabel ? (
          <div className="acMobileRuntimePhaseRow">
            <dt>{copy.fields.model}</dt>
            <dd>{step.modelLabel}</dd>
          </div>
        ) : null}
        {completedAt ? (
          <div className="acMobileRuntimePhaseRow">
            <dt>{copy.fields.time}</dt>
            <dd>{completedAt}</dd>
          </div>
        ) : null}
        {duration ? (
          <div className="acMobileRuntimePhaseRow">
            <dt>{copy.fields.duration}</dt>
            <dd>{duration}</dd>
          </div>
        ) : null}
      </dl>

      {step.errorMessage ? (
        <p className="acMobileRuntimePhaseError" role="alert">
          {step.errorMessage}
        </p>
      ) : null}
    </li>
  )
}
