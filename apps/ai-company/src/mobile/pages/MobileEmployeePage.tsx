import { useCallback } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import { useI18n } from '../../i18n'
import { MobileActionSheet } from '../patterns/MobileActionSheet'
import { useMobileBottomSheet } from '../hooks/useMobileBottomSheet'
import { useMobileEmployeeMax } from '../hooks/useMobileEmployeeMax'
import { MobileEmployeeHeroCard } from '../components/MobileEmployeeHeroCard'
import { MobileEmployeeWorkdayCard } from '../components/MobileEmployeeWorkdayCard'
import { MobileWorkQueueCard } from '../components/MobileWorkQueueCard'
import { MobileLastResultCard } from '../components/MobileLastResultCard'
import { MobileSection } from '../components/MobileSection'

export function MobileEmployeePage() {
  const { id: rawId } = useParams<{ id: string }>()
  const { t } = useI18n()
  const { openSheet, closeSheet } = useMobileBottomSheet()
  const navigate = useNavigate()
  const max = useMobileEmployeeMax()
  const copy = t.mobile.maxControl

  const resolvedId = rawId ? resolveCanonicalEmployeeId(rawId) : MAX_WORKER_EMPLOYEE_ID

  const openQuickTaskSheet = useCallback(() => {
    openSheet(
      <MobileActionSheet
        items={[
          {
            id: 'run-task',
            label: copy.quickTask.runTask,
            description: copy.quickTask.runTaskHint,
            onSelect: () => {
              closeSheet()
              navigate(`/mobile/tasks/new?employee=${MAX_WORKER_EMPLOYEE_ID}`)
            },
          },
          {
            id: 'template',
            label: copy.quickTask.useTemplate,
            description: copy.quickTask.templateHint,
            onSelect: () => {
              closeSheet()
              max.addTestTask()
            },
          },
          {
            id: 'placeholder',
            label: copy.quickTask.mobileFormPlaceholder,
            description: copy.quickTask.mobileFormHint,
            onSelect: () => {
              closeSheet()
              navigate(`/mobile/tasks/new?employee=${MAX_WORKER_EMPLOYEE_ID}`)
            },
          },
        ]}
      />,
      { title: copy.quickTask.title, ariaLabel: copy.quickTask.title },
    )
  }, [closeSheet, copy.quickTask, max, navigate, openSheet])

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

      <MobileSection title={copy.sections.workday}>
        <MobileEmployeeWorkdayCard
          operatingDay={max.snapshot.operatingDay}
          onStart={max.startWorkday}
          onContinue={max.continueWorkday}
          onFinish={max.finishWorkday}
        />
      </MobileSection>

      <MobileSection title={copy.sections.workQueue}>
        <MobileWorkQueueCard
          workQueue={max.snapshot.workQueue}
          isRunning={max.isRunning}
          onAddTestTask={max.addTestTask}
          onRunNext={max.runNext}
        />
      </MobileSection>

      <MobileSection title={copy.sections.lastResult}>
        <MobileLastResultCard
          lastJournalEntry={max.snapshot.lastJournalEntry}
          lastOperatingDaySummary={max.snapshot.lastOperatingDaySummary}
          hasPriorActivity={max.snapshot.hasPriorActivity}
          onAssignTask={openQuickTaskSheet}
          onStartWorkday={max.startWorkday}
        />
      </MobileSection>

      <MobileSection title={copy.sections.quickTask}>
        <div className="acMobileMaxQuickTask">
          <p className="acMobileMaxQuickTaskHint">{copy.quickTask.description}</p>
          <button type="button" className="acMobilePrimaryBtn acMobileMaxQuickTaskBtn" onClick={openQuickTaskSheet}>
            {copy.quickTask.button}
          </button>
          <Link to="/ops/morning-report" className="acMobileLinkBtn">
            {copy.quickTask.morningReport}
          </Link>
        </div>
      </MobileSection>
    </>
  )
}
