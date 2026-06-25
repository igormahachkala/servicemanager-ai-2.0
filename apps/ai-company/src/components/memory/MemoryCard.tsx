import type { MemoryEntry } from '../../domain/memory/memoryEntry'
import { MEMORY_TYPE_META } from '../../domain/memory/memoryTypes'
import { getWorkspaceById } from '../../mission-control/data/workspace'
import { useI18n } from '../../i18n'

export function MemoryCard({ entry }: { entry: MemoryEntry }) {
  const { t } = useI18n()
  const meta = MEMORY_TYPE_META[entry.type]
  const workspace = entry.workspaceId ? getWorkspaceById(entry.workspaceId) : null

  return (
    <article className="mcMemoryCard">
      <div className="mcMemoryCardHead">
        <span className="mcMemoryTypeIcon" aria-hidden>
          {meta.icon}
        </span>
        <div className="mcMemoryCardTitleBlock">
          <h3 className="mcMemoryCardTitle">{entry.title}</h3>
          <div className="mcMemoryCardMeta mcMono mcMuted">
            {t.memoryEngine.types[entry.type]} · {t.memoryEngine.sources[entry.source]}
          </div>
        </div>
        <span className={`mcMemoryImportance mcMemoryImportance${capitalize(entry.importance)}`}>
          {t.memoryEngine.importance[entry.importance]}
        </span>
      </div>

      <p className="mcMemoryCardSummary">{entry.summary}</p>

      {entry.content ? <p className="mcMemoryCardContent">{entry.content}</p> : null}

      <div className="mcMemoryCardFoot">
        <span className="mcMono mcMuted" style={{ fontSize: 11 }}>
          {new Date(entry.updatedAt).toLocaleString()}
        </span>
        {workspace ? (
          <span className="mcMemoryTag">{workspace.name}</span>
        ) : null}
        {entry.tags.map((tag) => (
          <span key={tag} className="mcMemoryTag">
            #{tag}
          </span>
        ))}
      </div>
    </article>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
