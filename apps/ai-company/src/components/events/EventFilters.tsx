import type { EventFilter } from '../../domain/events/eventStorage'
import { EVENT_SEVERITIES, EVENT_TYPES } from '../../domain/events/eventStorage'
import { agents } from '../../mission-control/data/mock'
import { loadWorkspaces } from '../../domain/workspaces/workspace'
import { useI18n } from '../../i18n'

type EventFiltersProps = {
  filter: EventFilter
  onChange: (next: EventFilter) => void
  showScopeFields?: boolean
}

export function EventFilters({ filter, onChange, showScopeFields = true }: EventFiltersProps) {
  const { t } = useI18n()
  const workspaces = loadWorkspaces()

  return (
    <div className="mcEventFilters">
      {showScopeFields ? (
        <>
          <label className="mcField mcEventFilterField">
            <span className="mcFieldLabel">{t.eventEngine.filters.employee}</span>
            <select
              className="mcSelect"
              value={filter.employeeId ?? 'all'}
              onChange={(event) => onChange({ ...filter, employeeId: event.target.value })}
            >
              <option value="all">{t.common.all}</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.codename}
                </option>
              ))}
            </select>
          </label>

          <label className="mcField mcEventFilterField">
            <span className="mcFieldLabel">{t.eventEngine.filters.workspace}</span>
            <select
              className="mcSelect"
              value={filter.workspaceId ?? 'all'}
              onChange={(event) => onChange({ ...filter, workspaceId: event.target.value })}
            >
              <option value="all">{t.common.all}</option>
              <option value="none">{t.eventEngine.filters.noWorkspace}</option>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}

      <label className="mcField mcEventFilterField">
        <span className="mcFieldLabel">{t.eventEngine.filters.severity}</span>
        <select
          className="mcSelect"
          value={filter.severity ?? 'all'}
          onChange={(event) =>
            onChange({
              ...filter,
              severity: event.target.value as EventFilter['severity'],
            })
          }
        >
          <option value="all">{t.common.all}</option>
          {EVENT_SEVERITIES.map((severity) => (
            <option key={severity} value={severity}>
              {t.feedSeverity[severity]}
            </option>
          ))}
        </select>
      </label>

      <label className="mcField mcEventFilterField">
        <span className="mcFieldLabel">{t.eventEngine.filters.type}</span>
        <select
          className="mcSelect"
          value={filter.type ?? 'all'}
          onChange={(event) =>
            onChange({
              ...filter,
              type: event.target.value as EventFilter['type'],
            })
          }
        >
          <option value="all">{t.common.all}</option>
          {EVENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {t.eventEngine.types[type]}
            </option>
          ))}
        </select>
      </label>

      <label className="mcField mcEventFilterField">
        <span className="mcFieldLabel">{t.eventEngine.filters.dateFrom}</span>
        <input
          className="mcInput"
          type="date"
          value={filter.dateFrom?.slice(0, 10) ?? ''}
          onChange={(event) =>
            onChange({
              ...filter,
              dateFrom: event.target.value ? `${event.target.value}T00:00:00.000Z` : undefined,
            })
          }
        />
      </label>

      <label className="mcField mcEventFilterField">
        <span className="mcFieldLabel">{t.eventEngine.filters.dateTo}</span>
        <input
          className="mcInput"
          type="date"
          value={filter.dateTo?.slice(0, 10) ?? ''}
          onChange={(event) =>
            onChange({
              ...filter,
              dateTo: event.target.value ? `${event.target.value}T23:59:59.999Z` : undefined,
            })
          }
        />
      </label>
    </div>
  )
}
