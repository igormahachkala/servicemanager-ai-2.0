import { Link } from 'react-router-dom'
import { AI_PHOTO_LAB_KICKOFF_PATH } from '../domain/projects/aiPhotoLabKickoff'
import { AI_PHOTO_LAB_PROJECT_ID } from '../domain/projects/aiPhotoLabIds'
import {
  ApprovalPanel,
  CodexHandoffPanel,
  DeliveryProgress,
  DemoReadinessChecklist,
  ProjectHealthPanel,
  ReportPanel,
  RiskPanel,
  RuntimeActivityPanel,
  TaskQueuePanel,
  TeamWorkload,
} from '../components/projects/control-room'
import { NextSuggestedActionsPanel } from '../components/work-scheduler'
import { useAiPhotoLabControlRoom } from '../hooks/useAiPhotoLabControlRoom'
import { useWorkScheduler } from '../hooks/useWorkScheduler'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { useI18n } from '../i18n'

export function AiPhotoLabControlRoomPage() {
  const { t } = useI18n()
  const { snapshot, stats } = useAiPhotoLabControlRoom()
  const { pending, approve, dismiss } = useWorkScheduler({
    projectId: AI_PHOTO_LAB_PROJECT_ID,
  })

  if (!snapshot) {
    return (
      <>
        <PageHeader
          title={t.photoLabControlRoom.notFoundTitle}
          description={t.photoLabControlRoom.notFoundDescription}
        />
        <Link to="/ops/projects" className="mcBtn mcBtnSecondary">
          {t.projects.backToList}
        </Link>
      </>
    )
  }

  return (
    <div className="mcControlRoomPage">
      <div className="mcPageHeaderRow">
        <PageHeader
          title={t.photoLabControlRoom.title}
          description={t.photoLabControlRoom.pageDescription}
        />
        <div className="mcControlRoomHeaderActions">
          <Link to={AI_PHOTO_LAB_KICKOFF_PATH} className="mcBtn mcBtnPrimary">
            {t.photoLabControlRoom.openKickoff}
          </Link>
          <Link
            to={`/ops/projects/${encodeURIComponent(AI_PHOTO_LAB_PROJECT_ID)}`}
            className="mcBtn mcBtnSecondary"
          >
            {t.photoLabControlRoom.openProject}
          </Link>
          <Link
            to={`/ops/canvas?projectId=${encodeURIComponent(AI_PHOTO_LAB_PROJECT_ID)}`}
            className="mcBtn mcBtnSecondary"
          >
            {t.photoLabControlRoom.openCanvas}
          </Link>
          <Link to="/ops/sprint/sprint-apl-1" className="mcBtn mcBtnSecondary">
            {t.sprintEngine.openSprint}
          </Link>
          <Link to="/ops/run-task" className="mcBtn mcBtnPrimary">
            {t.taskRunner.actions.openRunTask}
          </Link>
          <Link to="/ops/timeline" className="mcBtn mcBtnSecondary">
            {t.pages.companyTimeline}
          </Link>
        </div>
      </div>

      <div className="mcControlRoomStats">
        <div className="mcControlRoomStat">
          <span className="mcControlRoomStatValue">{stats.tasksTotal}</span>
          <span className="mcControlRoomStatLabel">{t.photoLabControlRoom.stats.tasks}</span>
        </div>
        <div className="mcControlRoomStat">
          <span className="mcControlRoomStatValue">{stats.tasksInProgress}</span>
          <span className="mcControlRoomStatLabel">{t.photoLabControlRoom.stats.inProgress}</span>
        </div>
        <div className="mcControlRoomStat">
          <span className="mcControlRoomStatValue">{stats.demoReady}/{stats.demoTotal}</span>
          <span className="mcControlRoomStatLabel">{t.photoLabControlRoom.stats.demoReady}</span>
        </div>
        <div className="mcControlRoomStat">
          <span className="mcControlRoomStatValue">{stats.pendingDecisions}</span>
          <span className="mcControlRoomStatLabel">{t.photoLabControlRoom.stats.decisions}</span>
        </div>
        <div className="mcControlRoomStat">
          <span className="mcControlRoomStatValue">{stats.codexItems}</span>
          <span className="mcControlRoomStatLabel">{t.photoLabControlRoom.stats.codex}</span>
        </div>
      </div>

      <div className="mcControlRoomGrid">
        <div className="mcControlRoomMain">
          <ProjectHealthPanel snapshot={snapshot} />
          <DeliveryProgress snapshot={snapshot} />
          <TaskQueuePanel snapshot={snapshot} />
          <CodexHandoffPanel snapshot={snapshot} />
          <DemoReadinessChecklist snapshot={snapshot} />
        </div>
        <div className="mcControlRoomSide">
          <TeamWorkload snapshot={snapshot} />
          <RuntimeActivityPanel snapshot={snapshot} />
          <ReportPanel snapshot={snapshot} />
          <RiskPanel snapshot={snapshot} />
          <ApprovalPanel snapshot={snapshot} />
          <Panel title={t.workScheduler.title}>
            <div className="mcProfilePanelBody">
              <NextSuggestedActionsPanel
                plan={null}
                pending={pending}
                compact
                onApprove={approve}
                onDismiss={dismiss}
              />
            </div>
          </Panel>
          <Panel title={t.photoLabControlRoom.sections.quickLinks}>
            <div className="mcProfilePanelBody mcControlRoomLinks">
              <Link to="/ops/sprint/sprint-apl-1">{t.sprintEngine.openSprint}</Link>
              <Link to={`/ops/collaboration?project=${encodeURIComponent(AI_PHOTO_LAB_PROJECT_ID)}`}>
                {t.collaborationEngine.openProjectCollaborations}
              </Link>
              <Link to={`/ops/chats/chat-ai-photo-lab-delivery`}>{t.pages.chats}</Link>
              <Link to="/ops/knowledge">{t.pages.knowledge}</Link>
              <Link to="/ops/notifications">{t.pages.notifications}</Link>
              <Link to={`/ops/execution?project=${encodeURIComponent(AI_PHOTO_LAB_PROJECT_ID)}`}>
                {t.pages.execution}
              </Link>
              <Link to="/ops/handoffs">{t.pages.handoffs}</Link>
              <Link to="/ops/tool-executions">{t.pages.toolExecutions}</Link>
            </div>
          </Panel>
        </div>
      </div>

      <p className="mcControlRoomLocalNote">{t.photoLabControlRoom.localNote}</p>
    </div>
  )
}
