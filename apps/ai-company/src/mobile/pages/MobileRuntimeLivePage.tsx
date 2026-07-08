import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MAX_WORKER_LOOP_SYNC_EVENT } from '../../hooks/useMaxWorkerLoop'
import { useI18n } from '../../i18n'
import { MobileEmptyState } from '../components/MobileEmptyState'
import { MobileGoldenPathCompleteSheet } from '../components/MobileGoldenPathCompleteSheet'
import { MobileRuntimeFailureDiagnostics } from '../components/MobileRuntimeFailureDiagnostics'
import { MobileRuntimePhaseCard } from '../components/MobileRuntimePhaseCard'
import { isMobileGoldenPathActive } from '../goldenPath/mobileGoldenPathStorage'
import { useMobileBottomSheet } from '../hooks/useMobileBottomSheet'
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
  const goldenCopy = t.mobile.goldenPath
  const location = useLocation()
  const { view } = useMobileRuntimeLive()
  const { openSheet, closeSheet } = useMobileBottomSheet()
  const completionShownRef = useRef(false)

  const goldenPathActive =
    isMobileGoldenPathActive() ||
    (location.state as { goldenPath?: boolean } | null)?.goldenPath === true

  useEffect(() => {
    if (!goldenPathActive || view) return
    const id = window.setInterval(() => {
      window.dispatchEvent(new CustomEvent(MAX_WORKER_LOOP_SYNC_EVENT))
    }, 450)
    return () => window.clearInterval(id)
  }, [goldenPathActive, view])

  useEffect(() => {
    if (!view || !goldenPathActive || completionShownRef.current) return
    if (view.loop.status !== 'completed' || !view.reportHref) return

    completionShownRef.current = true
    openSheet(
      <MobileGoldenPathCompleteSheet reportHref={view.reportHref} onClose={closeSheet} />,
      {
        title: goldenCopy.complete.sheetTitle,
        ariaLabel: goldenCopy.complete.sheetTitle,
        dismissible: false,
      },
    )
  }, [closeSheet, goldenCopy.complete.sheetTitle, goldenPathActive, openSheet, view])

  if (!view) {
    return (
      <div className="acMobilePage acMobileRuntimeLivePage" data-mobile-guide="runtime-overview">
        {goldenPathActive ? (
          <div className="acMobileRuntimeLiveWaiting" role="status">
            <p className="acMobileRuntimeLiveWaitingTitle">{goldenCopy.runtimeWaiting.title}</p>
            <p className="acMobileRuntimeLiveWaitingDescription">
              {goldenCopy.runtimeWaiting.description}
            </p>
          </div>
        ) : (
          <>
            <MobileEmptyState
              variant="noTasks"
              actionLabel={copy.empty.action}
              actionHref={MOBILE_PATHS.max}
            />
            <p className="acMobileRuntimeLiveEmptyHint">{copy.empty.description}</p>
          </>
        )}
      </div>
    )
  }

  const elapsed = formatElapsed(view.elapsedMs)
  const isCompleted = view.loop.status === 'completed'
  const showReportPrimary = isCompleted && Boolean(view.reportHref)

  return (
    <div className="acMobilePage acMobileRuntimeLivePage" data-mobile-guide="runtime-overview">
      <p className="acMobilePageIntro acMobileRuntimeLiveIntro">{copy.intro}</p>

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

      {view.failureDiagnostics ? (
        <MobileRuntimeFailureDiagnostics
          diagnostics={view.failureDiagnostics}
          hint={view.failureHint}
        />
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
        {showReportPrimary ? (
          <Link to={view.reportHref!} className="acMobilePrimaryBtn">
            {copy.actions.openReport}
          </Link>
        ) : null}
        <Link
          to={goldenPathActive ? MOBILE_PATHS.today : MOBILE_PATHS.max}
          className={
            showReportPrimary
              ? 'acMobileSecondaryBtn acMobileRuntimeLiveBack'
              : 'acMobilePrimaryBtn acMobileRuntimeLiveBack'
          }
        >
          {goldenPathActive ? goldenCopy.backToToday : copy.actions.backToMax}
        </Link>
      </div>
    </div>
  )
}
