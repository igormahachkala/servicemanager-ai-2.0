import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import {
  getDefaultMobileEmployeeId,
  hasMobileEmployeeCapability,
  mobileEmployeeChatPath,
  mobileEmployeeProfilePath,
  mobileEmployeeTasksNewPath,
  resolveMobileEmployeeFromRoute,
} from '../../domain/mobileEmployee'
import { useI18n } from '../../i18n'
import { resolveMobileEmployeeProfileCopy } from '../mobileEmployeeCopy'
import { useMobileEmployeeProfile } from '../hooks/useMobileEmployeeProfile'
import { useMobileEmployeeConversationMemory } from '../hooks/useMobileEmployeeConversationMemory'
import { useMobileRunNextSheet } from '../hooks/useMobileRunNextSheet'
import { MobileEmployeeHeroCard } from '../components/MobileEmployeeHeroCard'
import { MobileEmployeeWorkdayCard } from '../components/MobileEmployeeWorkdayCard'
import { MobileWorkQueueCard } from '../components/MobileWorkQueueCard'
import { MobileLastResultCard } from '../components/MobileLastResultCard'
import { MobileSection } from '../components/MobileSection'
import { MobileRuntimeLiveBanner } from '../components/MobileRuntimeLiveBanner'
import { MobileStandardTaskQuickStart } from '../components/MobileStandardTaskQuickStart'
import { MobileEmployeeRegistryProfileCard } from '../components/MobileEmployeeRegistryProfileCard'
import { MobileEmployeeExecutionNotice } from '../components/MobileEmployeeExecutionNotice'
import { MobileEmployeeScopedReportsCard } from '../components/MobileEmployeeScopedReportsCard'
import { MobileEmployeeConversationMemoryCard } from '../components/MobileEmployeeConversationMemoryCard'

export function MobileEmployeePage() {
  const { id: rawId } = useParams<{ id: string }>()
  const location = useLocation()
  const { t } = useI18n()
  const registryEntry = rawId ? resolveMobileEmployeeFromRoute(rawId) : null
  const employeeId = registryEntry?.employeeId ?? getDefaultMobileEmployeeId()
  const profile = useMobileEmployeeProfile(employeeId)
  const memory = useMobileEmployeeConversationMemory(employeeId)
  const { openRunNextFlow } = useMobileRunNextSheet()
  const copy = resolveMobileEmployeeProfileCopy(employeeId, t.mobile)

  useEffect(() => {
    profile.refresh()
    memory.refresh()
  }, [location.key, memory.refresh, profile.refresh])

  if (!rawId) {
    return <Navigate to={`/mobile/employees/${getDefaultMobileEmployeeId()}`} replace />
  }

  if (!registryEntry) {
    return <Navigate to={`/mobile/employees/${getDefaultMobileEmployeeId()}`} replace />
  }

  const showRuntime = hasMobileEmployeeCapability(employeeId, 'runtime_live')
  const showWorkerLoop = hasMobileEmployeeCapability(employeeId, 'worker_loop')
  const showStandardTask = hasMobileEmployeeCapability(employeeId, 'standard_task_quick_start')
  const showConversationMemory = hasMobileEmployeeCapability(employeeId, 'conversation_memory')
  const executionNotice =
    'executionNotice' in copy && typeof copy.executionNotice === 'string' && !showWorkerLoop
      ? copy.executionNotice
      : null

  return (
    <div className="acMobilePage acMobileMaxPage">
      {!profile.snapshot.hasPriorActivity ? (
        <div className="acMobileMaxReadyBanner" role="status">
          <p>{copy.readyBanner}</p>
        </div>
      ) : (
        <div className="acMobileMaxActiveBanner" role="status">
          <p>{copy.activeBanner}</p>
        </div>
      )}

      {executionNotice ? <MobileEmployeeExecutionNotice message={executionNotice} /> : null}

      {showRuntime && profile.activeWorkerLoop ? (
        <div data-mobile-guide="max-runtime">
          <MobileRuntimeLiveBanner
            loopId={profile.activeWorkerLoop.id}
            taskTitle={
              profile.activeWorkerLoop.input.title?.trim() ||
              profile.activeWorkerLoop.input.taskText.slice(0, 120)
            }
          />
        </div>
      ) : showRuntime ? (
        <div data-mobile-guide="max-runtime" className="acMobileGuideRuntimePlaceholder">
          <p className="acMobileOwnerHomeMuted">{copy.runtimeGuideHint}</p>
        </div>
      ) : null}

      <MobileEmployeeHeroCard
        snapshot={profile.snapshot}
        heroCopy={copy.hero}
        chatHref={mobileEmployeeChatPath(employeeId)}
      />

      {profile.snapshot.registryProfile ? (
        <MobileSection title={copy.sections.registryProfile}>
          <MobileEmployeeRegistryProfileCard
            profile={profile.snapshot.registryProfile}
            copy={copy.registryProfile}
          />
        </MobileSection>
      ) : null}

      <MobileSection title={copy.hero.openChat}>
        <Link to={mobileEmployeeChatPath(employeeId)} className="acMobilePrimaryBtn">
          {copy.hero.openChat}
        </Link>
      </MobileSection>

      {showStandardTask ? <MobileStandardTaskQuickStart /> : null}

      <div data-mobile-guide="max-queue">
        <MobileSection title={copy.sections.workQueue}>
          <MobileWorkQueueCard
            workQueue={profile.snapshot.workQueue}
            isRunning={profile.isRunning}
            showRunNext={showWorkerLoop}
            assignTaskHref={mobileEmployeeTasksNewPath(employeeId)}
            workQueueCopy={copy.workQueue}
            onRunNext={() => openRunNextFlow({ goldenPath: true })}
          />
        </MobileSection>
      </div>

      <div data-mobile-guide="max-workday">
        <MobileSection title={copy.sections.workday}>
          <MobileEmployeeWorkdayCard
            operatingDay={profile.snapshot.operatingDay}
            workdayCopy={copy.workday}
            profilePath={mobileEmployeeProfilePath(employeeId)}
            onStart={profile.startWorkday}
            onContinue={profile.continueWorkday}
            onFinish={profile.finishWorkday}
          />
        </MobileSection>
      </div>

      {showConversationMemory ? (
        <MobileSection title={copy.sections.conversationMemory}>
          <MobileEmployeeConversationMemoryCard
            employeeId={employeeId}
            context={memory.snapshot.context}
            messageCount={memory.snapshot.messageCount}
            copy={copy.conversationMemory}
          />
        </MobileSection>
      ) : null}

      <MobileSection title={copy.sections.reports}>
        <MobileEmployeeScopedReportsCard employeeId={employeeId} copy={copy.scopedReports} />
      </MobileSection>

      <div data-mobile-guide="max-result">
        <MobileSection title={copy.sections.lastResult}>
          <MobileLastResultCard
            lastJournalEntry={profile.snapshot.lastJournalEntry}
            lastOperatingDaySummary={profile.snapshot.lastOperatingDaySummary}
            hasPriorActivity={profile.snapshot.hasPriorActivity}
            lastResultCopy={copy.lastResult}
            onStartWorkday={profile.startWorkday}
          />
        </MobileSection>
      </div>
    </div>
  )
}
