import { Link } from 'react-router-dom'
import { Panel } from '../ui'
import type { EmployeeRef } from '../../data/conversation'
import { useI18n } from '../../../i18n'

function SidebarPlaceholder(props: { title: string; description: string }) {
  const { t } = useI18n()

  return (
    <div className="mcConversationSidebarPlaceholder">
      <div className="mcConversationSidebarPlaceholderTitle">{props.title}</div>
      <p className="mcConversationSidebarPlaceholderDesc">{props.description}</p>
      <span className="mcConversationFutureBadge">{t.conversations.futureBadge}</span>
    </div>
  )
}

export function ConversationSidebar({ employee }: { employee: EmployeeRef }) {
  const { t } = useI18n()

  return (
    <aside className="mcConversationSidebar">
      <Panel title={t.conversations.sidebar.employeeProfile}>
        <div className="mcProfilePanelBody">
          <div className="mcConversationProfileCard">
            <div className="mcConversationProfileName">{employee.name}</div>
            <div className="mcMono mcMuted">{employee.codename}</div>
            <div className="mcMuted" style={{ fontSize: 12, marginTop: 4 }}>
              {employee.role}
            </div>
            {employee.source === 'custom' ? (
              <Link
                to={`/ops/employees/${employee.id}`}
                className="mcBtn mcBtnSecondary mcBtnSmall"
                style={{ marginTop: 10 }}
              >
                {t.employees.openProfile}
              </Link>
            ) : (
              <span className="mcConversationFutureBadge" style={{ marginTop: 10 }}>
                {t.conversations.sourceBuiltin}
              </span>
            )}
          </div>
        </div>
      </Panel>

      <Panel title={t.conversations.sidebar.pinnedNotes}>
        <div className="mcProfilePanelBody">
          <SidebarPlaceholder
            title={t.conversations.sidebar.pinnedNotes}
            description={t.conversations.sidebar.pinnedNotesDesc}
          />
        </div>
      </Panel>

      <Panel title={t.conversations.sidebar.sharedDocuments}>
        <div className="mcProfilePanelBody">
          <SidebarPlaceholder
            title={t.conversations.sidebar.sharedDocuments}
            description={t.conversations.sidebar.sharedDocumentsDesc}
          />
        </div>
      </Panel>

      <Panel title={t.conversations.sidebar.recentTopics}>
        <div className="mcProfilePanelBody">
          <SidebarPlaceholder
            title={t.conversations.sidebar.recentTopics}
            description={t.conversations.sidebar.recentTopicsDesc}
          />
        </div>
      </Panel>

      <Panel title={t.conversations.sidebar.quickActions}>
        <div className="mcProfilePanelBody">
          <SidebarPlaceholder
            title={t.conversations.sidebar.quickActions}
            description={t.conversations.sidebar.quickActionsDesc}
          />
        </div>
      </Panel>
    </aside>
  )
}
