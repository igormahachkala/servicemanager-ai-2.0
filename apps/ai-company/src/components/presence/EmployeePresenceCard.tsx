import { Link } from 'react-router-dom'
import type { EmployeePresence } from '../../domain/presence'
import { resolveEmployeeLabel } from '../../domain/presence/employeeLabel'
import {
  resolveLivingActivityForEmployee,
  resolveLivingActivityFromPresence,
} from '../../domain/living'
import { LivingActivityLine } from '../living'
import { EmployeeStatusBadge } from './EmployeeStatusBadge'
import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import { useI18n } from '../../i18n'

export function EmployeePresenceCard(props: { presence: EmployeePresence }) {
  const { t } = useI18n()
  const { presence } = props
  const label = resolveEmployeeLabel(presence.employeeId)
  const living =
    resolveLivingActivityFromPresence(presence) ??
    resolveLivingActivityForEmployee(presence.employeeId)

  return (
    <article className="acPresenceCard">
      <div className="acPresenceCardHead">
        <div>
          <Link
            to={`/ops/employees/${resolveCanonicalEmployeeId(presence.employeeId)}`}
            className="acPresenceCardName acLink"
          >
            {label.codename}
          </Link>
          <div className="acMuted" style={{ fontSize: 12 }}>
            {label.name}
          </div>
        </div>
        <EmployeeStatusBadge status={presence.status} compact />
      </div>
      {living ? (
        <LivingActivityLine
          snapshot={living}
          compact
          showProgress={living.progress !== null}
          showSince={Boolean(living.since)}
        />
      ) : (
        <div className="acPresenceCardActivity">{presence.activity}</div>
      )}
      <div className="acPresenceCardMeta mcMono acMuted">
        {t.presence.since} {new Date(presence.startedAt).toLocaleTimeString()}
        {presence.expectedFinish ? (
          <>
            {' '}
            · {t.presence.expected} {new Date(presence.expectedFinish).toLocaleTimeString()}
          </>
        ) : null}
      </div>
    </article>
  )
}
