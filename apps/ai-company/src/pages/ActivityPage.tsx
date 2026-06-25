import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { EventFilters } from '../components/events/EventFilters'
import { EventSummary } from '../components/events/EventSummary'
import { Timeline } from '../components/events/Timeline'
import { useEvents } from '../hooks/useEvents'
import { useI18n } from '../i18n'
import { resolveEmployee } from '../mission-control/data/conversation'
import { getWorkspaceById } from '../domain/workspaces/workspace'

export function ActivityPage() {
  const { t } = useI18n()
  const [searchParams] = useSearchParams()
  const employeeId = searchParams.get('employeeId')
  const workspaceId = searchParams.get('workspaceId')

  const scope = employeeId ? 'employee' : workspaceId ? 'workspace' : 'company'
  const scopeId = employeeId ?? workspaceId

  const { filtered, grouped, stats, query, setQuery, filter, setFilter } = useEvents({
    scope,
    scopeId,
  })

  const employee = employeeId ? resolveEmployee(employeeId) : null
  const workspace = workspaceId ? getWorkspaceById(workspaceId) : null

  const scopeLabel =
    employee != null
      ? t.eventEngine.scopes.employee.replace('{name}', employee.codename)
      : workspace != null
        ? t.eventEngine.scopes.workspace.replace('{name}', workspace.name)
        : t.eventEngine.scopes.company

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader title={t.pages.activity} description={t.eventEngine.activityDescription} />
        <Link to="/ops/timeline" className="mcBtn mcBtnSecondary">
          {t.pages.companyTimeline}
        </Link>
      </div>

      <div className="mcEventScopeBanner">
        <span className="mcEventScopeLabel">{t.eventEngine.scopeLabel}</span>
        <strong>{scopeLabel}</strong>
        {employeeId || workspaceId ? (
          <Link to="/ops/activity" className="mcLinkInline">
            {t.eventEngine.clearScope}
          </Link>
        ) : null}
      </div>

      <EventSummary stats={stats} />

      <Panel
        title={t.eventEngine.activityTitle}
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
          <EventFilters
            filter={filter}
            onChange={setFilter}
            showScopeFields={scope === 'company'}
          />
          <Timeline groups={grouped} />
        </div>
      </Panel>

      <p className="mcMemoryLocalNote">{t.eventEngine.localOnly}</p>
    </>
  )
}
