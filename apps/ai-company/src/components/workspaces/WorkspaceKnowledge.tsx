import { Link } from 'react-router-dom'
import { Panel } from '../../mission-control/components/ui'
import { KnowledgeCard } from '../knowledge/KnowledgeCard'
import { KnowledgeCollections } from '../knowledge/KnowledgeCollections'
import { useKnowledge } from '../../hooks/useKnowledge'
import { useKnowledgeCollections } from '../../hooks/useKnowledgeCollections'
import { useI18n } from '../../i18n'

export function WorkspaceKnowledge({ workspaceId }: { workspaceId: string }) {
  const { t } = useI18n()
  const { getForWorkspace } = useKnowledge()
  const { collectionsWithItems } = useKnowledgeCollections()

  const items = getForWorkspace(workspaceId).filter((item) => item.status === 'published')
  const collections = collectionsWithItems.filter(
    (collection) => collection.workspaceId === workspaceId || collection.workspaceId === null,
  )

  return (
    <div className="mcStack">
      <Panel
        title={t.workspaces.tabs.knowledge}
        right={
          <Link to="/ops/knowledge" className="mcBtn mcBtnSecondary mcBtnSmall">
            {t.knowledgeEngine.openCatalog}
          </Link>
        }
      >
        <div className="mcProfilePanelBody mcStack">
          <p className="mcMuted">{t.knowledgeEngine.workspaceTabDescription}</p>
          {items.length === 0 ? (
            <div className="mcKnowledgeEmptyInline mcMuted">{t.knowledgeEngine.emptyWorkspace}</div>
          ) : (
            <div className="mcKnowledgeCardGrid">
              {items.map((item) => (
                <KnowledgeCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </Panel>

      <Panel title={t.knowledgeEngine.collectionsTitle}>
        <KnowledgeCollections collections={collections} compact />
      </Panel>
    </div>
  )
}
