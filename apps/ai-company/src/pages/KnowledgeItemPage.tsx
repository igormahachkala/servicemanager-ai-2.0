import { Link, useParams } from 'react-router-dom'
import { Panel } from '../mission-control/components/ui'
import { KnowledgeHeader } from '../components/knowledge/KnowledgeHeader'
import { useKnowledge } from '../hooks/useKnowledge'
import { useI18n } from '../i18n'

export function KnowledgeItemPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const { getById } = useKnowledge()
  const item = id ? getById(id) : null

  if (!item) {
    return (
      <div className="mcKnowledgeEmpty">
        <div className="mcKnowledgeEmptyTitle">{t.knowledgeEngine.notFoundTitle}</div>
        <p className="mcKnowledgeEmptyDesc">{t.knowledgeEngine.notFoundDescription}</p>
        <Link to="/ops/knowledge" className="mcBtn mcBtnPrimary">
          {t.knowledgeEngine.backToList}
        </Link>
      </div>
    )
  }

  return (
    <div className="mcKnowledgeItemPage">
      <KnowledgeHeader item={item} />

      <Panel title={t.knowledgeEngine.contentTitle}>
        <div className="mcKnowledgeContent">
          <pre className="mcKnowledgeContentBody">{item.content}</pre>
        </div>
      </Panel>

      <p className="mcReportPrincipleNote">{t.knowledgeEngine.runtimeNote}</p>
      <p className="mcMemoryLocalNote">{t.knowledgeEngine.localOnly}</p>
    </div>
  )
}
