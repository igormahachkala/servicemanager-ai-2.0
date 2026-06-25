import { Link } from 'react-router-dom'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { AuditTimeline } from '../components/audit/AuditTimeline'
import { AuditFilters } from '../components/audit/AuditFilters'
import { useAudit } from '../hooks/useAudit'
import { useI18n } from '../i18n'

export function AuditPage() {
  const { t } = useI18n()
  const { filtered, stats, query, setQuery, filter, setFilter } = useAudit()

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader title={t.pages.audit} description={t.audit.pageDescription} />
        <Link to="/ops/reports" className="mcBtn mcBtnSecondary">
          {t.pages.reports}
        </Link>
      </div>

      <div className="mcGrid4" style={{ marginBottom: 16 }}>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.audit.stats.total}</div>
          <div className="mcMetricValue">{stats.total}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.audit.stats.owner}</div>
          <div className="mcMetricValue">{stats.owner}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.audit.stats.employee}</div>
          <div className="mcMetricValue">{stats.employee}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.audit.stats.system}</div>
          <div className="mcMetricValue">{stats.system}</div>
        </div>
      </div>

      <Panel
        title={t.audit.timelineTitle}
        right={<span className="mcMono mcMuted">{filtered.length} {t.audit.eventCount}</span>}
      >
        <div className="mcProfilePanelBody mcStack">
          <label className="mcField mcMemorySearch">
            <span className="mcFieldLabel">{t.audit.searchLabel}</span>
            <input
              className="mcInput"
              type="search"
              value={query}
              placeholder={t.audit.searchPlaceholder}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <AuditFilters filter={filter} onChange={setFilter} />
          <AuditTimeline events={filtered} />
        </div>
      </Panel>

      <p className="mcReportPrincipleNote">{t.audit.auditPrincipleNote}</p>
      <p className="mcMemoryLocalNote">{t.audit.localOnly}</p>
    </>
  )
}
