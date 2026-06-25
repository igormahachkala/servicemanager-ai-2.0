import { Link, useNavigate } from 'react-router-dom'
import { Panel } from '../../mission-control/components/ui'
import type { Chat } from '../../domain/chats/chat'
import { ChatParticipants } from './ChatParticipants'
import { useRuntime } from '../../hooks/useRuntime'
import { useI18n } from '../../i18n'

function SidebarPlaceholder(props: { title: string; description: string }) {
  const { t } = useI18n()

  return (
    <div className="mcChatSidebarPlaceholder">
      <div className="mcChatSidebarPlaceholderTitle">{props.title}</div>
      <p className="mcChatSidebarPlaceholderDesc">{props.description}</p>
      <span className="mcChatFutureBadge">{t.chats.futureBadge}</span>
    </div>
  )
}

export function ChatSidebar({ chat }: { chat: Chat }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { startRun } = useRuntime()

  const employeeId =
    chat.participants.find((participant) => participant.type === 'employee' && participant.employeeId)
      ?.employeeId ?? null

  const handleOrchestratorRun = () => {
    if (!employeeId) return
    const run = startRun({
      employeeId,
      chatId: chat.id,
      workspaceId: chat.workspaceId,
      taskType: 'conversation',
    })
    navigate(`/ops/runtime/runs/${run.id}`)
  }

  return (
    <aside className="mcChatSidebar">
      <Panel title={t.chats.sidebar.participants}>
        <div className="mcProfilePanelBody">
          <ChatParticipants participants={chat.participants} />
        </div>
      </Panel>

      {chat.workspaceId ? (
        <Panel title={t.chats.sidebar.workspace}>
          <div className="mcProfilePanelBody">
            <Link to={`/ops/workspaces/${chat.workspaceId}`} className="mcBtn mcBtnSecondary mcBtnSmall">
              {t.chats.openWorkspace}
            </Link>
          </div>
        </Panel>
      ) : null}

      {employeeId ? (
        <Panel title={t.runtimeOrchestrator.runPageTitle}>
          <div className="mcProfilePanelBody">
            <p className="mcMuted">{t.runtimeOrchestrator.pageDescription}</p>
            <button type="button" className="mcBtn mcBtnPrimary mcBtnSmall" onClick={handleOrchestratorRun}>
              {t.runtimeOrchestrator.startRunFromChat}
            </button>
          </div>
        </Panel>
      ) : null}

      <Panel title={t.chats.sidebar.pinnedNotes}>
        <div className="mcProfilePanelBody">
          <SidebarPlaceholder
            title={t.chats.sidebar.pinnedNotes}
            description={t.chats.sidebar.pinnedNotesDesc}
          />
        </div>
      </Panel>

      <Panel title={t.chats.sidebar.artifacts}>
        <div className="mcProfilePanelBody">
          <SidebarPlaceholder
            title={t.chats.sidebar.artifacts}
            description={t.chats.sidebar.artifactsDesc}
          />
        </div>
      </Panel>
    </aside>
  )
}
