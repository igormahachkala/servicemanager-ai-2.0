import { useI18n } from '../../i18n'

type EventSummaryProps = {
  stats: {
    total: number
    info: number
    success: number
    warn: number
    error: number
    withEmployee: number
    withWorkspace: number
  }
}

export function EventSummary({ stats }: EventSummaryProps) {
  const { t } = useI18n()

  return (
    <div className="mcGrid4" style={{ marginBottom: 16 }}>
      <div className="mcMetric">
        <div className="mcMetricLabel">{t.eventEngine.stats.total}</div>
        <div className="mcMetricValue">{stats.total}</div>
      </div>
      <div className="mcMetric">
        <div className="mcMetricLabel">{t.eventEngine.stats.success}</div>
        <div className="mcMetricValue">{stats.success}</div>
      </div>
      <div className="mcMetric">
        <div className="mcMetricLabel">{t.eventEngine.stats.warn}</div>
        <div className="mcMetricValue">{stats.warn}</div>
      </div>
      <div className="mcMetric">
        <div className="mcMetricLabel">{t.eventEngine.stats.withWorkspace}</div>
        <div className="mcMetricValue">{stats.withWorkspace}</div>
      </div>
    </div>
  )
}
