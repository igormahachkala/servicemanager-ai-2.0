import { Link } from 'react-router-dom'
import { Card } from '../layout'
import { AI_PHOTO_LAB_CHAT_ID } from '../../domain/projects'
import type { Project } from '../../domain/projects'
import { useChats } from '../../hooks/useChats'
import { useI18n } from '../../i18n'
import { formatFeedTime } from '../../mission-control/components/ui'

export function ProjectChats({ project }: { project: Project }) {
  const { t } = useI18n()
  const { chats } = useChats()

  const related = chats.filter(
    (chat) =>
      chat.id === AI_PHOTO_LAB_CHAT_ID ||
      chat.workspaceId === project.workspaceId ||
      chat.title.includes('ai-photo-lab'),
  )

  return (
    <Card title={t.projects.chats.title}>
      <p className="acMuted" style={{ marginBottom: 16 }}>
        {t.projects.chats.description}
      </p>
      {related.length === 0 ? (
        <p className="acMuted">{t.projects.chats.empty}</p>
      ) : (
        related.map((chat) => (
          <div key={chat.id} className="acListRow">
            <Link to={`/ops/chats/${encodeURIComponent(chat.id)}`} className="acLink">
              {chat.title}
            </Link>
            <span className="acMono acMuted">{formatFeedTime(chat.updatedAt)}</span>
            <span className="acMuted">{chat.messages.length} {t.projects.chats.messages}</span>
          </div>
        ))
      )}
      <Link to="/ops/chats/new" className="mcBtn mcBtnSecondary mcBtnSmall" style={{ marginTop: 12 }}>
        {t.projects.chats.open}
      </Link>
    </Card>
  )
}
