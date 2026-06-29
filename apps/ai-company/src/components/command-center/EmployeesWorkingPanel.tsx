import { Link } from 'react-router-dom'
import type { CommandCenterEmployeeRow } from '../../domain/commandCenter'
import { Card } from '../layout'
import { EmployeePresenceCard } from '../presence'
import { usePresence } from '../../hooks/usePresence'
import { useI18n } from '../../i18n'

type Props = {
  working: CommandCenterEmployeeRow[]
  waiting: CommandCenterEmployeeRow[]
}

function fallbackPresence(row: CommandCenterEmployeeRow) {
  return {
    employeeId: row.employeeId,
    status: row.status,
    currentProjectId: null,
    currentWorkspaceId: null,
    currentTaskId: null,
    currentRunId: null,
    activity: row.activity,
    startedAt: new Date().toISOString(),
    expectedFinish: null,
    updatedAt: new Date().toISOString(),
  }
}

export function EmployeesWorkingPanel({ working, waiting }: Props) {
  const { t } = useI18n()
  const { getByEmployeeId } = usePresence()

  return (
    <Card
      title={t.commandCenter.sections.employeesWorking}
      action={<Link to="/ops/presence" className="acLink">{t.executiveDashboard.actionOpenPresence}</Link>}
    >
      <div className="acMetricTileSub" style={{ marginBottom: 12 }}>
        {t.executiveDashboard.presenceSub
          .replace('{working}', String(working.length))
          .replace('{waiting}', String(waiting.length))}
      </div>
      <div className="acPresenceCardGrid">
        {working.slice(0, 4).map((row) => (
          <EmployeePresenceCard
            key={row.employeeId}
            presence={getByEmployeeId(row.employeeId) ?? fallbackPresence(row)}
          />
        ))}
        {waiting.slice(0, 2).map((row) => (
          <EmployeePresenceCard
            key={row.employeeId}
            presence={getByEmployeeId(row.employeeId) ?? fallbackPresence(row)}
          />
        ))}
        {working.length === 0 && waiting.length === 0 ? (
          <div className="acMuted">{t.presence.dashboard.noWorking}</div>
        ) : null}
      </div>
    </Card>
  )
}
