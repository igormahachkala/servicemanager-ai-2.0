import {
  AUDIT_ACTIONS,
  AUDIT_ACTOR_TYPES,
  AUDIT_TARGET_TYPES,
} from '../../domain/audit/auditTypes'
import type { AuditFilter } from '../../domain/audit/auditEvent'
import { useI18n } from '../../i18n'

export function AuditFilters(props: {
  filter: AuditFilter
  onChange: (filter: AuditFilter) => void
}) {
  const { t } = useI18n()

  return (
    <div className="mcAuditFilters">
      <label className="mcField mcAuditFilterField">
        <span className="mcFieldLabel">{t.audit.filters.actor}</span>
        <select
          className="mcInput"
          value={props.filter.actorType ?? 'all'}
          onChange={(event) =>
            props.onChange({
              ...props.filter,
              actorType: event.target.value as AuditFilter['actorType'],
            })
          }
        >
          <option value="all">{t.common.all}</option>
          {AUDIT_ACTOR_TYPES.map((item) => (
            <option key={item} value={item}>
              {t.audit.actors[item]}
            </option>
          ))}
        </select>
      </label>

      <label className="mcField mcAuditFilterField">
        <span className="mcFieldLabel">{t.audit.filters.action}</span>
        <select
          className="mcInput"
          value={props.filter.action ?? 'all'}
          onChange={(event) =>
            props.onChange({
              ...props.filter,
              action: event.target.value as AuditFilter['action'],
            })
          }
        >
          <option value="all">{t.common.all}</option>
          {AUDIT_ACTIONS.map((item) => (
            <option key={item} value={item}>
              {t.audit.actions[item]}
            </option>
          ))}
        </select>
      </label>

      <label className="mcField mcAuditFilterField">
        <span className="mcFieldLabel">{t.audit.filters.target}</span>
        <select
          className="mcInput"
          value={props.filter.targetType ?? 'all'}
          onChange={(event) =>
            props.onChange({
              ...props.filter,
              targetType: event.target.value as AuditFilter['targetType'],
            })
          }
        >
          <option value="all">{t.common.all}</option>
          {AUDIT_TARGET_TYPES.map((item) => (
            <option key={item} value={item}>
              {t.audit.targetTypes[item]}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
