import { Link } from 'react-router-dom'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { ReportCard } from '../components/reports/ReportCard'
import { ContextEmptyState } from '../components/empty-states'
import { REPORT_TYPES, REPORT_STATUSES } from '../domain/reports/reportTypes'
import type { ReportFilter } from '../domain/reports/report'
import { useReports } from '../hooks/useReports'
import { useI18n } from '../i18n'
import { EMPLOYEE_ROUTE_IDS } from '../mission-control/data/employeeIdResolver'

export function ReportsPage() {
  const { t } = useI18n()
  const { filtered, stats, query, setQuery, filter, setFilter } = useReports()

  const typeFilter = filter.type ?? 'all'
  const statusFilter = filter.status ?? 'all'

  const handleFilterChange = (patch: Partial<ReportFilter>) => {
    setFilter({ ...filter, ...patch })
  }

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader title={t.pages.reports} description={t.reports.pageDescription} />
        <Link to="/ops/notifications?type=report" className="mcBtn mcBtnSecondary">
          {t.notificationEngine.reportInbox}
        </Link>
        <Link to={`/ops/employees/${EMPLOYEE_ROUTE_IDS.max}/learning`} className="mcBtn mcBtnSecondary">
          {t.learningEngine.teamLearning}
        </Link>
        <Link to="/ops/collaboration" className="mcBtn mcBtnSecondary">
          {t.pages.collaboration}
        </Link>
        <Link to="/ops/projects/project-ai-photo-lab/control-room" className="mcBtn mcBtnSecondary">
          {t.pages.controlRoom}
        </Link>
        <Link to="/ops/handoffs" className="mcBtn mcBtnSecondary">
          {t.pages.handoffs}
        </Link>
        <Link to="/ops/audit" className="mcBtn mcBtnSecondary">
          {t.pages.audit}
        </Link>
      </div>

      <div className="mcGrid4" style={{ marginBottom: 16 }}>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.reports.stats.total}</div>
          <div className="mcMetricValue">{stats.total}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.reports.stats.published}</div>
          <div className="mcMetricValue">{stats.published}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.reports.stats.reviewed}</div>
          <div className="mcMetricValue">{stats.reviewed}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.reports.stats.draft}</div>
          <div className="mcMetricValue">{stats.draft}</div>
        </div>
      </div>

      <Panel
        title={t.reports.catalogTitle}
        right={<span className="mcMono mcMuted">{filtered.length} {t.reports.reportCount}</span>}
      >
        <div className="mcReportFilters">
          <label className="mcField mcReportFilterField">
            <span className="mcFieldLabel">{t.reports.filters.search}</span>
            <input
              className="mcInput"
              type="search"
              value={query}
              placeholder={t.reports.searchPlaceholder}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="mcField mcReportFilterField">
            <span className="mcFieldLabel">{t.reports.filters.type}</span>
            <select
              className="mcInput"
              value={typeFilter}
              onChange={(event) =>
                handleFilterChange({ type: event.target.value as ReportFilter['type'] })
              }
            >
              <option value="all">{t.common.all}</option>
              {REPORT_TYPES.map((item) => (
                <option key={item} value={item}>
                  {t.reports.types[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="mcField mcReportFilterField">
            <span className="mcFieldLabel">{t.reports.filters.status}</span>
            <select
              className="mcInput"
              value={statusFilter}
              onChange={(event) =>
                handleFilterChange({ status: event.target.value as ReportFilter['status'] })
              }
            >
              <option value="all">{t.common.all}</option>
              {REPORT_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {t.reports.status[item]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {filtered.length === 0 ? (
          <ContextEmptyState
            area="reports"
            variant={stats.total === 0 ? 'initial' : 'filtered'}
          />
        ) : (
          <div className="mcReportGrid">
            {filtered.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        )}
      </Panel>

      <p className="mcReportPrincipleNote">{t.reports.reportsFirstNote}</p>
      <p className="mcMemoryLocalNote">{t.reports.localOnly}</p>
    </>
  )
}
