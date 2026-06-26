import { Link } from 'react-router-dom'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { EventFilters } from '../components/events/EventFilters'
import { EventSummary } from '../components/events/EventSummary'
import { Timeline } from '../components/events/Timeline'
import { WorkdayTimeline } from '../components/presence'
import { ToolExecutionLog } from '../components/toolExecution'
import { getRecentCollaborationSessions } from '../domain/collaboration/collaborationStorage'
import { listHandoffs } from '../domain/handoff'
import { listToolExecutions } from '../domain/toolExecution'
import { HandoffCard } from '../components/handoff'
import { useEvents } from '../hooks/useEvents'
import { usePresence } from '../hooks/usePresence'
import { useI18n } from '../i18n'

export function CompanyTimelinePage() {
  const { t } = useI18n()
  const { todayEvents } = usePresence()
  const { filtered, grouped, stats, query, setQuery, filter, setFilter } = useEvents({
    scope: 'company',
  })
  const recentCollaborations = getRecentCollaborationSessions(3)
  const recentHandoffs = listHandoffs().slice(0, 4)

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
        <Link to="/ops/collaboration" className="mcBtn mcBtnSecondary">
          {t.pages.collaboration}
        </Link>
        <Link to="/ops/projects/project-ai-photo-lab/control-room" className="mcBtn mcBtnSecondary">
          {t.pages.controlRoom}
        </Link>
      </div>

      <EventSummary stats={stats} />

      <Panel title={t.presence.timeline.title}>
        <p className="acMuted" style={{ marginBottom: 12 }}>
          {t.presence.timeline.description}
        </p>
        <WorkdayTimeline events={todayEvents.slice(0, 10)} />
      </Panel>

      <Panel title={t.collaborationEngine.timelinePreview}>
        <div className="mcProfilePanelBody">
          {recentCollaborations.length === 0 ? (
            <p className="mcMuted">{t.collaborationEngine.empty.sessions}</p>
          ) : (
            <ul className="mcCollabPreviewList">
              {recentCollaborations.map((session) => (
                <li key={session.id}>
                  <Link to={`/ops/collaboration/${session.id}`}>{session.title}</Link>
                  <span className="mcMuted">
                    {t.collaborationEngine.status[session.status]} ·{' '}
                    {session.participants.map((item) => item.codename).join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/ops/collaboration" className="acLink" style={{ marginTop: 12, display: 'inline-block' }}>
            {t.pages.collaboration}
          </Link>
        </div>
      </Panel>

      <Panel title={t.pages.handoffs}>
        <div className="acHandoffList mcProfilePanelBody">
          {recentHandoffs.length === 0 ? (
            <p className="mcMuted">{t.handoffEngine.empty}</p>
          ) : (
            recentHandoffs.map((handoff) => <HandoffCard key={handoff.id} handoff={handoff} compact />)
          )}
        </div>
        <Link to="/ops/handoffs" className="acLink" style={{ marginTop: 12, display: 'inline-block' }}>
          {t.pages.handoffs}
        </Link>
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
