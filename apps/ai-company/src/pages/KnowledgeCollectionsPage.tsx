import { Link } from 'react-router-dom'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { KnowledgeCollections } from '../components/knowledge/KnowledgeCollections'
import { useKnowledgeCollections } from '../hooks/useKnowledgeCollections'
import { useI18n } from '../i18n'

export function KnowledgeCollectionsPage() {
  const { t } = useI18n()
  const { collectionsWithItems } = useKnowledgeCollections()

  return (
    <>
      <div className="mcOrgPageTop">
        <Link to="/ops/knowledge" className="mcBtn mcBtnSecondary mcBtnSmall">
          {t.knowledgeEngine.backToList}
        </Link>
      </div>

      <PageHeader
        title={t.knowledgeEngine.collectionsTitle}
        description={t.knowledgeEngine.collectionsDescription}
      />

      <Panel title={t.knowledgeEngine.collectionsTitle}>
        <KnowledgeCollections collections={collectionsWithItems} />
      </Panel>

      <p className="mcReportPrincipleNote">{t.knowledgeEngine.assignmentNote}</p>
      <p className="mcMemoryLocalNote">{t.knowledgeEngine.localOnly}</p>
    </>
  )
}
