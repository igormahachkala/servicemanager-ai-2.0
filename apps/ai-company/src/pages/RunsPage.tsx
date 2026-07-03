import { Link } from 'react-router-dom'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { RunCard } from '../components/run/RunCard'
import { ContextEmptyState } from '../components/empty-states'
import { RuntimeCostDashboard } from '../components/runtime-monitor'
import { useRunHistory } from '../hooks/useRunHistory'
import { useRuntimeMonitor } from '../hooks/useRuntimeMonitor'
import { useWorkspaces } from '../hooks/useWorkspaces'
import { useCustomEmployees } from '../mission-control/hooks/useCustomEmployees'
import { useI18n } from '../i18n'

export function RunsPage() {
  const { t } = useI18n()
  const { filtered, stats, query, setQuery, filter, setFilter } = useRunHistory()
  const { dashboard } = useRuntimeMonitor()
  const { employees } = useCustomEmployees()
  const { workspaces } = useWorkspaces()

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader title={t.pages.runs} description={t.runEngine.pageDescription} />
        <Link to="/ops/timeline" className="mcBtn mcBtnSecondary">
          {t.runEngine.openTimeline}
        </Link>
      </div>

      <div className="mcRunStatsGrid">
        <div className="mcRunStatCard">
          <div className="mcRunStatValue">{stats.total}</div>
          <div className="mcRunStatLabel mcMuted">{t.runEngine.stats.total}</div>
        </div>
        <div className="mcRunStatCard">
          <div className="mcRunStatValue">{stats.completed}</div>
          <div className="mcRunStatLabel mcMuted">{t.runEngine.stats.completed}</div>
        </div>
        <div className="mcRunStatCard">
          <div className="mcRunStatValue">{stats.waitingApproval}</div>
          <div className="mcRunStatLabel mcMuted">{t.runEngine.stats.waitingApproval}</div>
        </div>
        <div className="mcRunStatCard">
          <div className="mcRunStatValue">{stats.failed}</div>
          <div className="mcRunStatLabel mcMuted">{t.runEngine.stats.failed}</div>
        </div>
      </div>

      <Panel title={t.runtimeMonitor.title}>
        <div className="mcProfilePanelBody">
          <RuntimeCostDashboard dashboard={dashboard} showRecentRuns={false} />
        </div>
      </Panel>

      <div style={{ marginTop: 16 }}>
        <Panel
          title={t.runEngine.catalogTitle}
          right={
            <span className="mcMono mcMuted">
              {filtered.length} {t.runEngine.runCount}
            </span>
          }
        >
          <div className="mcProfilePanelBody mcStack">
            <label className="mcField mcMemorySearch">
              <span className="mcFieldLabel">{t.runEngine.searchLabel}</span>
              <input
                className="mcInput"
                type="search"
                value={query}
                placeholder={t.runEngine.searchPlaceholder}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>

            <div className="mcRunFilters">
              <label className="mcRunFilterField">
                <span className="mcFieldLabel">{t.runEngine.filters.status}</span>
                <select
                  className="mcInput"
                  value={filter.status}
                  onChange={(event) =>
                    setFilter({ ...filter, status: event.target.value as typeof filter.status })
                  }
                >
                  <option value="all">{t.common.all}</option>
                  {(['completed', 'running', 'waiting_approval', 'failed', 'cancelled', 'queued'] as const).map(
                    (status) => (
                      <option key={status} value={status}>
                        {t.runEngine.statuses[status]}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="mcRunFilterField">
                <span className="mcFieldLabel">{t.runEngine.filters.employee}</span>
                <select
                  className="mcInput"
                  value={filter.employeeId}
                  onChange={(event) => setFilter({ ...filter, employeeId: event.target.value })}
                >
                  <option value="all">{t.common.all}</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.codename}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mcRunFilterField">
                <span className="mcFieldLabel">{t.runEngine.filters.workspace}</span>
                <select
                  className="mcInput"
                  value={filter.workspaceId}
                  onChange={(event) =>
                    setFilter({
                      ...filter,
                      workspaceId: event.target.value as typeof filter.workspaceId,
                    })
                  }
                >
                  <option value="all">{t.common.all}</option>
                  <option value="none">{t.runEngine.platformWide}</option>
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {filtered.length === 0 ? (
              <ContextEmptyState
                area="runtime"
                variant={stats.total === 0 ? 'initial' : 'filtered'}
                compact
              />
            ) : (
              <div className="mcRunCardGrid">
                {filtered.map((run) => (
                  <RunCard key={run.id} run={run} />
                ))}
              </div>
            )}
          </div>
        </Panel>
      </div>

      <p className="mcReportPrincipleNote">{t.runEngine.principleNote}</p>
      <p className="mcMemoryLocalNote">{t.runEngine.localOnly}</p>
    </>
  )
}
