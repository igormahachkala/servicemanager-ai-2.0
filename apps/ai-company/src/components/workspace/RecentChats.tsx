import { Link } from 'react-router-dom'
import type { EmployeeWorkspaceSnapshot } from '../../hooks/useEmployeeWorkspace'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

export function RecentChats({ snapshot }: { snapshot: EmployeeWorkspaceSnapshot }) {
  const { t } = useI18n()

  return (
    <Panel
      title={t.employeeWorkspace.sections.chats}
      right={
        <Link
          to={`/ops/chats/${encodeURIComponent(`conv:${snapshot.employee.id}`)}`}
          className="mcBtn mcBtnSecondary mcBtnSm"
        >
          {t.employeeWorkspace.openChat}
        </Link>
      }
    >
      <div className="mcProfilePanelBody">
        {snapshot.chats.length === 0 ? (
          <p className="mcMuted">{t.employeeWorkspace.empty.chats}</p>
        ) : (
          <ul className="acWorkspaceChatList">
            {snapshot.chats.map((chat) => {
              const lastMessage = chat.messages[chat.messages.length - 1]
              return (
                <li key={chat.id}>
                  <Link to={`/ops/chats/${encodeURIComponent(chat.id)}`} className="acWorkspaceChatItem">
                    <span className="acWorkspaceChatTitle">{chat.title}</span>
                    <span className="mcMuted acWorkspaceChatPreview">
                      {lastMessage?.content.slice(0, 80) ?? t.employeeWorkspace.noMessages}
                    </span>
                    <span className="mcMono mcMuted">
                      {new Date(chat.updatedAt).toLocaleString()}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Panel>
  )
}
