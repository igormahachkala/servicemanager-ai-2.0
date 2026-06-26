import { Link } from 'react-router-dom'
import type { CommandCenterEmployeeRow } from '../../domain/commandCenter'
import { Card } from '../layout'
import { EmployeePresenceCard } from '../presence'
import { useI18n } from '../../i18n'

type Props = {
  working: CommandCenterEmployeeRow[]
  waiting: CommandCenterEmployeeRow[]
}

export function EmployeesWorkingPanel({ working, waiting }: Props) {
  const { t } = useI18n()

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
            presence={{
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
            }}
          />
        ))}
        {waiting.slice(0, 2).map((row) => (
          <EmployeePresenceCard
            key={row.employeeId}
            presence={{
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
            }}
          />
        ))}
        {working.length === 0 && waiting.length === 0 ? (
          <div className="acMuted">{t.presence.dashboard.noWorking}</div>
        ) : null}
      </div>
    </Card>
  )
}
