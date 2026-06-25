import { Link } from 'react-router-dom'
import type { Knowledge } from '../../domain/knowledge/knowledge'
import { useI18n } from '../../i18n'

function statusClass(status: Knowledge['status']): string {
  if (status === 'published') return 'mcKnowledgeStatusPublished'
  if (status === 'draft') return 'mcKnowledgeStatusDraft'
  return 'mcKnowledgeStatusArchived'
}

export function KnowledgeCard({ item }: { item: Knowledge }) {
  const { t } = useI18n()

  return (
    <Link to={`/ops/knowledge/${item.id}`} className="mcKnowledgeCard mcKnowledgeCardLink">
      <div className="mcKnowledgeCardHeader">
        <h3 className="mcKnowledgeCardTitle">{item.title}</h3>
        <span className={`mcKnowledgeStatusBadge ${statusClass(item.status)}`}>
          {t.knowledgeEngine.statuses[item.status]}
        </span>
      </div>
      <p className="mcKnowledgeCardSummary mcMuted">{item.summary}</p>
      <div className="mcKnowledgeCardMeta">
        <span className="mcKnowledgeTypeBadge">{t.knowledgeEngine.types[item.type]}</span>
        <span className="mcMono mcMuted">{t.knowledgeEngine.sources[item.source]}</span>
      </div>
      {item.tags.length > 0 ? (
        <div className="mcTagRow">
          {item.tags.map((tag) => (
            <span key={tag} className="mcTag">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mcKnowledgeCardFooter mcMuted">
        {item.workspaceId ? (
          <span className="mcMono">{item.workspaceId}</span>
        ) : (
          <span>{t.knowledgeEngine.platformWide}</span>
        )}
        <span>{new Date(item.updatedAt).toLocaleDateString()}</span>
      </div>
    </Link>
  )
}
