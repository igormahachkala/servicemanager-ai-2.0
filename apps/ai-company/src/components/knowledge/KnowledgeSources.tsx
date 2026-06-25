import type { KnowledgeSource } from '../../domain/knowledge/knowledgeSource'
import { KNOWLEDGE_SOURCES } from '../../domain/knowledge/knowledgeSource'
import { useI18n } from '../../i18n'

type Props = {
  counts: Partial<Record<KnowledgeSource, number>>
}

export function KnowledgeSources({ counts }: Props) {
  const { t } = useI18n()

  return (
    <div className="mcKnowledgeSourcesGrid">
      {KNOWLEDGE_SOURCES.map((source) => (
        <div key={source} className="mcKnowledgeSourceCard">
          <div className="mcKnowledgeSourceLabel">{t.knowledgeEngine.sources[source]}</div>
          <div className="mcKnowledgeSourceCount">{counts[source] ?? 0}</div>
        </div>
      ))}
    </div>
  )
}
