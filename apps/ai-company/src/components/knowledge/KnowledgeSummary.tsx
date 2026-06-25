import type { KnowledgeStats } from '../../domain/knowledge/knowledgeStorage'
import { useI18n } from '../../i18n'

export function KnowledgeSummary({ stats }: { stats: KnowledgeStats }) {
  const { t } = useI18n()

  const items = [
    { label: t.knowledgeEngine.stats.total, value: stats.total },
    { label: t.knowledgeEngine.stats.published, value: stats.published },
    { label: t.knowledgeEngine.stats.collections, value: stats.collections },
    { label: t.knowledgeEngine.stats.assignments, value: stats.assignments },
    { label: t.knowledgeEngine.stats.platformWide, value: stats.platformWide },
    { label: t.knowledgeEngine.stats.workspaceScoped, value: stats.workspaceScoped },
  ]

  return (
    <div className="mcKnowledgeStatsGrid">
      {items.map((item) => (
        <div key={item.label} className="mcKnowledgeStatCard">
          <div className="mcKnowledgeStatValue">{item.value}</div>
          <div className="mcKnowledgeStatLabel mcMuted">{item.label}</div>
        </div>
      ))}
    </div>
  )
}
