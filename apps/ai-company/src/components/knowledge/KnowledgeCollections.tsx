import { Link } from 'react-router-dom'
import type { KnowledgeCollection } from '../../domain/knowledge/knowledgeCollection'
import type { Knowledge } from '../../domain/knowledge/knowledge'
import { useI18n } from '../../i18n'

type CollectionWithItems = KnowledgeCollection & { knowledgeItems: Knowledge[] }

export function KnowledgeCollections({
  collections,
  compact = false,
}: {
  collections: CollectionWithItems[]
  compact?: boolean
}) {
  const { t } = useI18n()

  if (collections.length === 0) {
    return (
      <div className="mcKnowledgeEmptyInline mcMuted">{t.knowledgeEngine.emptyCollections}</div>
    )
  }

  return (
    <div className={compact ? 'mcKnowledgeCollectionListCompact' : 'mcKnowledgeCollectionGrid'}>
      {collections.map((collection) => (
        <div key={collection.id} className="mcKnowledgeCollectionCard">
          <div className="mcKnowledgeCollectionHead">
            <h3 className="mcKnowledgeCollectionTitle">{collection.title}</h3>
            <span className="mcMono mcMuted">
              {collection.items.length} {t.knowledgeEngine.itemsUnit}
            </span>
          </div>
          <p className="mcKnowledgeCollectionDesc mcMuted">{collection.description}</p>
          {!compact ? (
            <ul className="mcKnowledgeCollectionItems">
              {collection.knowledgeItems.map((item) => (
                <li key={item.id}>
                  <Link to={`/ops/knowledge/${item.id}`}>{item.title}</Link>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mcKnowledgeCollectionMeta mcMuted">
            {collection.workspaceId ? (
              <span className="mcMono">{collection.workspaceId}</span>
            ) : (
              <span>{t.knowledgeEngine.platformWide}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
