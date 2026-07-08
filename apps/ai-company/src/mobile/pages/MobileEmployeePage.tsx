import { useEffect } from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import { useI18n } from '../../i18n'
import { useMobileEmployeeMax } from '../hooks/useMobileEmployeeMax'
import { MobileEmployeeHeroCard } from '../components/MobileEmployeeHeroCard'
import { MobileEmployeeWorkdayCard } from '../components/MobileEmployeeWorkdayCard'
import { MobileWorkQueueCard } from '../components/MobileWorkQueueCard'
import { MobileLastResultCard } from '../components/MobileLastResultCard'
import { MobileSection } from '../components/MobileSection'
import { MobileRuntimeLiveBanner } from '../components/MobileRuntimeLiveBanner'
import { MobileStandardTaskQuickStart } from '../components/MobileStandardTaskQuickStart'

export function MobileEmployeePage() {
  const { id: rawId } = useParams<{ id: string }>()
  const location = useLocation()
  const { t } = useI18n()
  const max = useMobileEmployeeMax()
  const copy = t.mobile.maxControl

  const resolvedId = rawId ? resolveCanonicalEmployeeId(rawId) : MAX_WORKER_EMPLOYEE_ID

  useEffect(() => {
    max.refresh()
  }, [location.key, max.refresh])

  if (!rawId) {
    return <Navigate to={`/mobile/employees/${MAX_WORKER_EMPLOYEE_ID}`} replace />
  }

  if (resolvedId !== MAX_WORKER_EMPLOYEE_ID) {
    return <Navigate to={`/mobile/employees/${MAX_WORKER_EMPLOYEE_ID}`} replace />
  }

  return (
    <>
      {!max.snapshot.hasPriorActivity ? (
        <div className="acMobileMaxReadyBanner" role="status">
          <p>{copy.readyBanner}</p>
        </div>
      ) : (
        <div className="acMobileMaxActiveBanner" role="status">
          <p>{copy.activeBanner}</p>
        </div>
      )}

      {max.activeWorkerLoop ? (
        <div data-mobile-guide="max-runtime">
          <MobileRuntimeLiveBanner
            loopId={max.activeWorkerLoop.id}
            taskTitle={
              max.activeWorkerLoop.input.title?.trim() ||
              max.activeWorkerLoop.input.taskText.slice(0, 120)
            }
          />
        </div>
      ) : (
        <div data-mobile-guide="max-runtime" className="acMobileGuideRuntimePlaceholder">
          <p className="acMobileOwnerHomeMuted">{copy.runtimeGuideHint}</p>
        </div>
      )}

      <MobileEmployeeHeroCard snapshot={max.snapshot} />

      <MobileStandardTaskQuickStart />

      <div data-mobile-guide="max-queue">
        <MobileSection title={copy.sections.workQueue}>
          <MobileWorkQueueCard
            workQueue={max.snapshot.workQueue}
            isRunning={max.isRunning}
            onRunNext={max.runNext}
          />
        </MobileSection>
      </div>

      <div data-mobile-guide="max-workday">
        <MobileSection title={copy.sections.workday}>
          <MobileEmployeeWorkdayCard
            operatingDay={max.snapshot.operatingDay}
            onStart={max.startWorkday}
            onContinue={max.continueWorkday}
            onFinish={max.finishWorkday}
          />
        </MobileSection>
      </div>

      <div data-mobile-guide="max-result">
        <MobileSection title={copy.sections.lastResult}>
          <MobileLastResultCard
            lastJournalEntry={max.snapshot.lastJournalEntry}
            lastOperatingDaySummary={max.snapshot.lastOperatingDaySummary}
            hasPriorActivity={max.snapshot.hasPriorActivity}
            onStartWorkday={max.startWorkday}
          />
        </MobileSection>
      </div>
    </>
  )
}
