import { Link } from 'react-router-dom'
import type { RuntimeRunMetrics } from '../../domain/runtimeMonitor'
import { formatCost, formatDurationMs, formatTokens } from '../../domain/runtimeMonitor'
import { RuntimeStateBadge } from '../runtime/RuntimeStateBadge'
import { useI18n } from '../../i18n'

type Props = {
  metrics: RuntimeRunMetrics
  compact?: boolean
}

export function RuntimeRunMetricsRow({ metrics, compact = false }: Props) {
  const { t } = useI18n()
  const rm = t.runtimeMonitor

  return (
    <div className={`acRuntimeMetricsRow${compact ? ' acRuntimeMetricsRowCompact' : ''}`}>
      <div className="acRuntimeMetricsCell">
        <span className="acRuntimeMetricsLabel">{rm.fields.model}</span>
        <span className="acRuntimeMetricsValue">{metrics.modelName}</span>
      </div>
      <div className="acRuntimeMetricsCell">
        <span className="acRuntimeMetricsLabel">{rm.fields.provider}</span>
        <span className="acRuntimeMetricsValue">{metrics.providerName}</span>
      </div>
      <div className="acRuntimeMetricsCell">
        <span className="acRuntimeMetricsLabel">{rm.fields.duration}</span>
        <span className="acRuntimeMetricsValue mcMono">{formatDurationMs(metrics.durationMs)}</span>
      </div>
      <div className="acRuntimeMetricsCell">
        <span className="acRuntimeMetricsLabel">{rm.fields.cpuTime}</span>
        <span className="acRuntimeMetricsValue mcMono">{formatDurationMs(metrics.cpuTimeMs)}</span>
      </div>
      <div className="acRuntimeMetricsCell">
        <span className="acRuntimeMetricsLabel">{rm.fields.tokens}</span>
        <span className="acRuntimeMetricsValue mcMono">{formatTokens(metrics.estimatedTokens)}</span>
      </div>
      <div className="acRuntimeMetricsCell">
        <span className="acRuntimeMetricsLabel">{rm.fields.cost}</span>
        <span className="acRuntimeMetricsValue mcMono">{formatCost(metrics.estimatedCost)}</span>
      </div>
      <div className="acRuntimeMetricsCell">
        <span className="acRuntimeMetricsLabel">{rm.fields.status}</span>
        <RuntimeStateBadge state={metrics.status} />
      </div>
      {!compact ? (
        <div className="acRuntimeMetricsCell acRuntimeMetricsCellWide">
          <span className="acRuntimeMetricsLabel">{rm.fields.employee}</span>
          <Link to={`/ops/employees/${metrics.employeeId}`} className="acLink">
            {metrics.employeeCodename}
          </Link>
        </div>
      ) : null}
    </div>
  )
}
