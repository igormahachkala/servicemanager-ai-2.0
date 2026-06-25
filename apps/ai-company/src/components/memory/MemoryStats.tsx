import type { MemoryStats } from '../../domain/memory/memoryEntry'
import { useI18n } from '../../i18n'

export function MemoryStats(props: { stats: MemoryStats }) {
  const { t } = useI18n()
  const { stats } = props

  return (
    <div className="mcGrid4 mcMemoryStats">
      <div className="mcMetric">
        <div className="mcMetricLabel">{t.memoryEngine.stats.total}</div>
        <div className="mcMetricValue">{stats.total}</div>
      </div>
      <div className="mcMetric">
        <div className="mcMetricLabel">{t.memoryEngine.stats.recentWeek}</div>
        <div className="mcMetricValue">{stats.recentWeek}</div>
      </div>
      <div className="mcMetric">
        <div className="mcMetricLabel">{t.memoryEngine.stats.withWorkspace}</div>
        <div className="mcMetricValue">{stats.withWorkspace}</div>
      </div>
      <div className="mcMetric">
        <div className="mcMetricLabel">{t.memoryEngine.stats.critical}</div>
        <div className="mcMetricValue">{stats.byImportance.critical}</div>
      </div>
    </div>
  )
}
