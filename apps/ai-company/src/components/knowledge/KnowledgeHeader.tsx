import { Link } from 'react-router-dom'
import type { Knowledge } from '../../domain/knowledge/knowledge'
import { resolveEmployee } from '../../mission-control/data/conversation'
import { useI18n } from '../../i18n'

function statusClass(status: Knowledge['status']): string {
  if (status === 'published') return 'mcKnowledgeStatusPublished'
  if (status === 'draft') return 'mcKnowledgeStatusDraft'
  return 'mcKnowledgeStatusArchived'
}

export function KnowledgeHeader({ item }: { item: Knowledge }) {
  const { t } = useI18n()
  const owner = item.ownerEmployeeId ? resolveEmployee(item.ownerEmployeeId) : null

  return (
    <header className="mcKnowledgeHeader">
      <div className="mcKnowledgeHeaderTop">
        <Link to="/ops/knowledge" className="mcProfileBack">
          ← {t.knowledgeEngine.backToList}
        </Link>
        <span className="mcMono mcMuted">{item.id}</span>
      </div>
      <div className="mcKnowledgeHeaderMain">
        <div className="mcKnowledgeHeaderTitleRow">
          <h1 className="mcKnowledgeTitle">{item.title}</h1>
          <span className={`mcKnowledgeStatusBadge ${statusClass(item.status)}`}>
            {t.knowledgeEngine.statuses[item.status]}
          </span>
        </div>
        <p className="mcKnowledgeSubtitle">{item.summary}</p>
        <div className="mcKnowledgeHeaderMeta">
          <span className="mcKnowledgeTypeBadge">{t.knowledgeEngine.types[item.type]}</span>
          <span className="mcMuted">{t.knowledgeEngine.sources[item.source]}</span>
          {owner ? <span className="mcMono mcMuted">{owner.codename}</span> : null}
          {item.workspaceId ? (
            <span className="mcMono mcMuted">{item.workspaceId}</span>
          ) : (
            <span className="mcMuted">{t.knowledgeEngine.platformWide}</span>
          )}
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
      </div>
    </header>
  )
}
