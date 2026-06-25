import type { RunMetrics } from '../../domain/run/runStorage'
import { useI18n } from '../../i18n'

function formatDuration(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms} ms`
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds} s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

export function RunMetricsPanel({ metrics }: { metrics: RunMetrics }) {
  const { t } = useI18n()

  const items = [
    { label: t.runEngine.metrics.duration, value: formatDuration(metrics.durationMs) },
    { label: t.runEngine.metrics.estimatedCost, value: `$${metrics.estimatedCost.toFixed(4)}` },
    { label: t.runEngine.metrics.estimatedTokens, value: metrics.estimatedTokens.toLocaleString() },
    { label: t.runEngine.metrics.memoryRecords, value: String(metrics.memoryRecords) },
    { label: t.runEngine.metrics.knowledgeRecords, value: String(metrics.knowledgeRecords) },
    { label: t.runEngine.metrics.toolCalls, value: String(metrics.toolCalls) },
    { label: t.runEngine.metrics.warnings, value: String(metrics.warnings) },
  ]

  return (
    <div className="mcRunMetricsGrid">
      {items.map((item) => (
        <div key={item.label} className="mcRunMetricCard">
          <div className="mcRunMetricLabel">{item.label}</div>
          <div className="mcRunMetricValue mcMono">{item.value}</div>
        </div>
      ))}
    </div>
  )
}
