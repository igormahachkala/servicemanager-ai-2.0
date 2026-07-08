import { useEffect } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import { useI18n } from '../../i18n'
import { useMobileEmployeeMax } from '../hooks/useMobileEmployeeMax'
import { MobileEmployeeHeroCard } from '../components/MobileEmployeeHeroCard'
import { MobileEmployeeWorkdayCard } from '../components/MobileEmployeeWorkdayCard'
import { MobileWorkQueueCard } from '../components/MobileWorkQueueCard'
import { MobileLastResultCard } from '../components/MobileLastResultCard'
import { MobileSection } from '../components/MobileSection'

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

      <MobileEmployeeHeroCard snapshot={max.snapshot} />

      <MobileSection title={copy.sections.workQueue}>
        <MobileWorkQueueCard
          workQueue={max.snapshot.workQueue}
          isRunning={max.isRunning}
          onRunNext={max.runNext}
        />
      </MobileSection>

      <MobileSection title={copy.sections.workday}>
        <MobileEmployeeWorkdayCard
          operatingDay={max.snapshot.operatingDay}
          onStart={max.startWorkday}
          onContinue={max.continueWorkday}
          onFinish={max.finishWorkday}
        />
      </MobileSection>

      <MobileSection title={copy.sections.lastResult}>
        <MobileLastResultCard
          lastJournalEntry={max.snapshot.lastJournalEntry}
          lastOperatingDaySummary={max.snapshot.lastOperatingDaySummary}
          hasPriorActivity={max.snapshot.hasPriorActivity}
          onStartWorkday={max.startWorkday}
        />
      </MobileSection>
    </>
  )
}
