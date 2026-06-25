import { Link } from 'react-router-dom'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { EventFilters } from '../components/events/EventFilters'
import { EventSummary } from '../components/events/EventSummary'
import { Timeline } from '../components/events/Timeline'
import { WorkdayTimeline } from '../components/presence'
import { ToolExecutionLog } from '../components/toolExecution'
import { listToolExecutions } from '../domain/toolExecution'
import { useEvents } from '../hooks/useEvents'
import { usePresence } from '../hooks/usePresence'
import { useI18n } from '../i18n'

export function CompanyTimelinePage() {
  const { t } = useI18n()
  const { todayEvents } = usePresence()
  const { filtered, grouped, stats, query, setQuery, filter, setFilter } = useEvents({
    scope: 'company',
  })

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader title={t.pages.companyTimeline} description={t.eventEngine.pageDescription} />
        <Link to="/ops/notifications" className="mcBtn mcBtnSecondary">
          {t.pages.notifications}
        </Link>
        <Link to="/ops/activity" className="mcBtn mcBtnSecondary">
          {t.pages.activity}
        </Link>
      </div>

      <EventSummary stats={stats} />

      <Panel title={t.presence.timeline.title}>
        <p className="acMuted" style={{ marginBottom: 12 }}>
          {t.presence.timeline.description}
        </p>
        <WorkdayTimeline events={todayEvents.slice(0, 10)} />
      </Panel>

      <Panel title={t.pages.toolExecutions}>
        <ToolExecutionLog
          executions={listToolExecutions().slice(0, 8)}
          selectedId={null}
          onSelect={() => undefined}
        />
        <Link to="/ops/tool-executions" className="acLink" style={{ marginTop: 12, display: 'inline-block' }}>
          {t.pages.toolExecutions}
        </Link>
      </Panel>

      <Panel
        title={t.eventEngine.timelineTitle}
        right={
          <span className="mcMono mcMuted">
            {filtered.length} {t.eventEngine.eventCount}
          </span>
        }
      >
        <div className="mcProfilePanelBody mcStack">
          <label className="mcField mcMemorySearch">
            <span className="mcFieldLabel">{t.eventEngine.searchLabel}</span>
            <input
              className="mcInput"
              type="search"
              value={query}
              placeholder={t.eventEngine.searchPlaceholder}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <EventFilters filter={filter} onChange={setFilter} />
          <Timeline groups={grouped} />
        </div>
      </Panel>

      <p className="mcReportPrincipleNote">{t.eventEngine.principleNote}</p>
      <p className="mcMuted">{t.notificationEngine.timelineHint}</p>
      <p className="mcMemoryLocalNote">{t.eventEngine.localOnly}</p>
    </>
  )
}
