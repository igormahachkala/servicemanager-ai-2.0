import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { MobileEmptyState } from '../components/MobileEmptyState'
import { MobileRuntimePhaseCard } from '../components/MobileRuntimePhaseCard'
import { useMobileRuntimeLive } from '../hooks/useMobileRuntimeLive'
import { MOBILE_PATHS } from '../navigation/mobileHrefResolver'

function formatElapsed(ms: number | null): string | null {
  if (ms == null || ms <= 0) return null
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds} с`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes} мин ${rest} с`
}

export function MobileRuntimeLivePage() {
  const { t } = useI18n()
  const copy = t.mobile.runtimeLive
  const { view } = useMobileRuntimeLive()

  if (!view) {
    return (
      <div className="acMobilePage acMobileRuntimeLivePage">
        <MobileEmptyState
          variant="noTasks"
          actionLabel={copy.empty.action}
          actionHref={MOBILE_PATHS.max}
        />
        <p className="acMobileRuntimeLiveEmptyHint">{copy.empty.description}</p>
      </div>
    )
  }

  const elapsed = formatElapsed(view.elapsedMs)

  return (
    <div className="acMobilePage acMobileRuntimeLivePage">
      <p className="acMobileRuntimeLiveIntro">{copy.intro}</p>

      <section className="acMobileRuntimeLiveHero" aria-label={copy.currentTask}>
        <div className="acMobileRuntimeLiveHeroHead">
          <span
            className={
              view.isLive
                ? 'acMobileRuntimeLiveBadge acMobileRuntimeLiveBadgeLive'
                : 'acMobileRuntimeLiveBadge'
            }
          >
            {view.loopStatusLabel}
          </span>
          {view.modelLabel ? (
            <span className="acMobileRuntimeLiveModel">{view.modelLabel}</span>
          ) : null}
        </div>
        <h2 className="acMobileRuntimeLiveTaskTitle">{view.taskTitle}</h2>
        {view.taskText !== view.taskTitle ? (
          <p className="acMobileRuntimeLiveTaskText">{view.taskText}</p>
        ) : null}
      </section>

      <section className="acMobileRuntimeLiveProgress" aria-label={copy.progress}>
        <div className="acMobileRuntimeLiveProgressHead">
          <span>{copy.progress}</span>
          <span>{view.progressPercent}%</span>
        </div>
        <div className="acMobileRuntimeLiveProgressTrack" aria-hidden>
          <div
            className="acMobileRuntimeLiveProgressFill"
            style={{ width: `${view.progressPercent}%` }}
          />
        </div>
        {elapsed ? (
          <p className="acMobileRuntimeLiveElapsed">
            {copy.fields.elapsed}: {elapsed}
          </p>
        ) : null}
      </section>

      {view.loopError ? (
        <p className="acMobileRuntimeLiveError" role="alert">
          {view.loopError}
        </p>
      ) : null}

      <ol className="acMobileRuntimePhaseList">
        {view.steps.map((step, index) => (
          <MobileRuntimePhaseCard
            key={step.id}
            step={step}
            index={index}
            isCurrent={step.id === view.currentStepId}
          />
        ))}
      </ol>

      <div className="acMobileRuntimeLiveActions">
        {view.reportHref ? (
          <Link to={view.reportHref} className="acMobilePrimaryBtn">
            {copy.actions.openReport}
          </Link>
        ) : null}
        <Link to={MOBILE_PATHS.max} className="acMobileSecondaryBtn acMobileRuntimeLiveBack">
          {copy.actions.backToMax}
        </Link>
      </div>
    </div>
  )
}
