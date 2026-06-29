import { Link } from 'react-router-dom'
import type { RuntimeMonitorDashboard } from '../../domain/runtimeMonitor'
import { formatCost, formatDurationMs, formatTokens } from '../../domain/runtimeMonitor'
import { useI18n } from '../../i18n'
import { RuntimeRunMetricsRow } from './RuntimeRunMetricsRow'

type Props = {
  dashboard: RuntimeMonitorDashboard
  compact?: boolean
  showRecentRuns?: boolean
  recentLimit?: number
}

export function RuntimeCostDashboard({
  dashboard,
  compact = false,
  showRecentRuns = true,
  recentLimit = 5,
}: Props) {
  const { t } = useI18n()
  const rm = t.runtimeMonitor

  return (
    <div className={`acRuntimeCostDashboard${compact ? ' acRuntimeCostDashboardCompact' : ''}`}>
      <div className="acRuntimeCostStats">
        <div className="acRuntimeCostStat">
          <span className="acRuntimeCostStatValue">
            {dashboard.averageRuntimeMs != null ? formatDurationMs(dashboard.averageRuntimeMs) : '—'}
          </span>
          <span className="acRuntimeCostStatLabel">{rm.dashboard.averageRuntime}</span>
        </div>
        <div className="acRuntimeCostStat">
          <span className="acRuntimeCostStatValue">
            {dashboard.longestRun
              ? formatDurationMs(dashboard.longestRun.cpuTimeMs ?? dashboard.longestRun.durationMs)
              : '—'}
          </span>
          <span className="acRuntimeCostStatLabel">{rm.dashboard.longestRun}</span>
        </div>
        <div className="acRuntimeCostStat">
          <span className="acRuntimeCostStatValue">{dashboard.timeoutRate}%</span>
          <span className="acRuntimeCostStatLabel">{rm.dashboard.timeoutRate}</span>
        </div>
        <div className="acRuntimeCostStat">
          <span className="acRuntimeCostStatValue">{dashboard.completedToday}</span>
          <span className="acRuntimeCostStatLabel">{rm.dashboard.completedToday}</span>
        </div>
        <div className="acRuntimeCostStat">
          <span className="acRuntimeCostStatValue">{formatCost(dashboard.totalCostToday)}</span>
          <span className="acRuntimeCostStatLabel">{rm.dashboard.costToday}</span>
        </div>
      </div>

      <div className="acRuntimeCostColumns">
        <section className="acRuntimeCostSection">
          <h3 className="acRuntimeCostSectionTitle">{rm.dashboard.fastModels}</h3>
          {dashboard.fastModels.length === 0 ? (
            <p className="acMuted">{rm.empty.fastModels}</p>
          ) : (
            <ul className="acRuntimeCostList">
              {dashboard.fastModels.map((item) => (
                <li key={item.modelId}>
                  <strong>{item.modelName}</strong>
                  <span className="acMuted">
                    {formatDurationMs(item.avgDurationMs)} · {item.runCount} {rm.runs}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="acRuntimeCostSection">
          <h3 className="acRuntimeCostSectionTitle">{rm.dashboard.heavyModels}</h3>
          {dashboard.heavyModels.length === 0 ? (
            <p className="acMuted">{rm.empty.heavyModels}</p>
          ) : (
            <ul className="acRuntimeCostList">
              {dashboard.heavyModels.map((item) => (
                <li key={item.modelId}>
                  <strong>{item.modelName}</strong>
                  <span className="acMuted">
                    {formatCost(item.avgCost)} avg · {formatCost(item.totalCost)} total
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="acRuntimeCostSection">
          <h3 className="acRuntimeCostSectionTitle">{rm.dashboard.topEmployees}</h3>
          {dashboard.topEmployees.length === 0 ? (
            <p className="acMuted">{rm.empty.topEmployees}</p>
          ) : (
            <ul className="acRuntimeCostList">
              {dashboard.topEmployees.map((item) => (
                <li key={item.employeeId}>
                  <Link to={`/ops/employees/${item.employeeId}/runtime`} className="acLink">
                    {item.codename}
                  </Link>
                  <span className="acMuted">
                    {item.runCount} {rm.runs} · {formatCost(item.totalCost)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="acRuntimeCostSection">
          <h3 className="acRuntimeCostSectionTitle">{rm.dashboard.topModels}</h3>
          {dashboard.topModels.length === 0 ? (
            <p className="acMuted">{rm.empty.topModels}</p>
          ) : (
            <ul className="acRuntimeCostList">
              {dashboard.topModels.map((item) => (
                <li key={item.modelId}>
                  <strong>{item.modelName}</strong>
                  <span className="acMuted">
                    {item.runCount} {rm.runs} · {formatTokens(item.totalTokens)} tok
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {showRecentRuns && dashboard.runs.length > 0 ? (
        <section className="acRuntimeCostRecent">
          <h3 className="acRuntimeCostSectionTitle">{rm.dashboard.recentRuns}</h3>
          <div className="acRuntimeCostRecentList">
            {dashboard.runs.slice(0, recentLimit).map((item) => (
              <div key={item.runId} className="acRuntimeCostRecentItem">
                <Link to={`/ops/runtime/runs/${encodeURIComponent(item.runId)}`} className="acLink mcMono">
                  {item.employeeCodename}
                </Link>
                <RuntimeRunMetricsRow metrics={item} compact />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
