import { Link } from 'react-router-dom'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { ContextEmptyState } from '../components/empty-states'
import { KnowledgeCard } from '../components/knowledge/KnowledgeCard'
import { KnowledgeFilters } from '../components/knowledge/KnowledgeFilters'
import { KnowledgeSearch } from '../components/knowledge/KnowledgeSearch'
import { KnowledgeSources } from '../components/knowledge/KnowledgeSources'
import { KnowledgeSummary } from '../components/knowledge/KnowledgeSummary'
import { useKnowledge } from '../hooks/useKnowledge'
import { useKnowledgeCollections } from '../hooks/useKnowledgeCollections'
import { useI18n } from '../i18n'

function FuturePlaceholder({ title, description }: { title: string; description: string }) {
  const { t } = useI18n()
  return (
    <div className="mcKnowledgeFutureCard">
      <span className="mcKnowledgeFutureBadge">{t.knowledgeEngine.futureBadge}</span>
      <div className="mcKnowledgeFutureTitle">{title}</div>
      <p className="mcKnowledgeFutureDesc mcMuted">{description}</p>
    </div>
  )
}

export function KnowledgePage() {
  const { t } = useI18n()
  const { filtered, stats, tags, query, setQuery, filter, setFilter, items } = useKnowledge()
  const { collectionsWithItems } = useKnowledgeCollections()

  const sourceCounts = items.reduce<Partial<Record<string, number>>>((acc, item) => {
    acc[item.source] = (acc[item.source] ?? 0) + 1
    return acc
  }, {})
  const evolutionItems = items.filter((item) => item.tags.includes('memory-evolution'))

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader title={t.pages.knowledge} description={t.knowledgeEngine.pageDescription} />
        <Link to="/ops/knowledge/collections" className="mcBtn mcBtnSecondary">
          {t.knowledgeEngine.openCollections}
        </Link>
        <Link to="/ops/collaboration" className="mcBtn mcBtnSecondary">
          {t.pages.collaboration}
        </Link>
        <Link to="/ops/projects/project-ai-photo-lab/control-room" className="mcBtn mcBtnSecondary">
          {t.pages.controlRoom}
        </Link>
      </div>

      <KnowledgeSummary stats={stats} />

      {evolutionItems.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <Panel title={t.memoryEvolution.knowledgeAdded}>
            <div className="mcProfilePanelBody mcKnowledgeEvolutionList">
              {evolutionItems.slice(0, 5).map((item) => (
                <KnowledgeCard key={item.id} item={item} />
              ))}
            </div>
          </Panel>
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <Panel
          title={t.knowledgeEngine.catalogTitle}
          right={
            <span className="mcMono mcMuted">
              {filtered.length} {t.knowledgeEngine.itemsUnit}
            </span>
          }
        >
          <div className="mcProfilePanelBody mcStack">
            <KnowledgeSearch query={query} onChange={setQuery} />
            <KnowledgeFilters filter={filter} tags={tags} onChange={setFilter} />
            {filtered.length === 0 ? (
              <ContextEmptyState
                area="knowledge"
                variant={items.length === 0 ? 'initial' : 'filtered'}
                actionHref={items.length === 0 ? undefined : '/ops/knowledge/collections'}
                compact
              />
            ) : (
              <div className="mcKnowledgeCardGrid">
                {filtered.map((item) => (
                  <KnowledgeCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </Panel>
      </div>

      <div className="mcKnowledgeSectionGrid">
        <Panel title={t.knowledgeEngine.sourcesTitle}>
          <KnowledgeSources counts={sourceCounts} />
        </Panel>

        <Panel title={t.knowledgeEngine.featuredCollections}>
          <div className="mcKnowledgeCollectionPreview">
            {collectionsWithItems.slice(0, 2).map((collection) => (
              <div key={collection.id} className="mcKnowledgeCollectionPreviewRow">
                <strong>{collection.title}</strong>
                <span className="mcMuted">
                  {collection.items.length} {t.knowledgeEngine.itemsUnit}
                </span>
              </div>
            ))}
            <Link to="/ops/knowledge/collections" className="mcBtn mcBtnSecondary mcBtnSmall">
              {t.knowledgeEngine.viewAllCollections}
            </Link>
          </div>
        </Panel>
      </div>

      <div style={{ marginTop: 16 }}>
        <Panel title={t.knowledgeEngine.futureTitle}>
          <div className="mcKnowledgeFutureGrid">
            <FuturePlaceholder
              title={t.knowledgeEngine.future.semanticSearch}
              description={t.knowledgeEngine.future.semanticSearchDesc}
            />
            <FuturePlaceholder
              title={t.knowledgeEngine.future.vectorSearch}
              description={t.knowledgeEngine.future.vectorSearchDesc}
            />
            <FuturePlaceholder
              title={t.knowledgeEngine.future.embeddings}
              description={t.knowledgeEngine.future.embeddingsDesc}
            />
            <FuturePlaceholder
              title={t.knowledgeEngine.future.knowledgeGraph}
              description={t.knowledgeEngine.future.knowledgeGraphDesc}
            />
            <FuturePlaceholder
              title={t.knowledgeEngine.future.aiSummaries}
              description={t.knowledgeEngine.future.aiSummariesDesc}
            />
            <FuturePlaceholder
              title={t.knowledgeEngine.future.recommendedReading}
              description={t.knowledgeEngine.future.recommendedReadingDesc}
            />
          </div>
        </Panel>
      </div>

      <p className="mcReportPrincipleNote">{t.knowledgeEngine.principleNote}</p>
      <p className="mcMemoryLocalNote">{t.knowledgeEngine.localOnly}</p>
    </>
  )
}
