import { Link } from 'react-router-dom'
import { HandoffCard } from '../handoff'
import type { EmployeeWorkspaceSnapshot } from '../../hooks/useEmployeeWorkspace'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

export function TodayAgenda({ snapshot }: { snapshot: EmployeeWorkspaceSnapshot }) {
  const { t } = useI18n()

  const agendaItems = [
    ...snapshot.todayEvents.map((event) => ({
      id: event.id,
      label: event.label,
      meta: event.type,
      href: `/ops/presence`,
    })),
    ...snapshot.approvals.map((approval) => ({
      id: approval.id,
      label: approval.title,
      meta: t.employeeWorkspace.agenda.approval,
      href: `/ops/approvals/${approval.id}`,
    })),
    ...snapshot.pendingHandoffs.slice(0, 3).map((handoff) => ({
      id: handoff.id,
      label: handoff.title,
      meta: t.employeeWorkspace.agenda.handoff,
      href: `/ops/handoffs/${handoff.id}`,
    })),
    ...snapshot.tasks.slice(0, 3).map((task) => ({
      id: task.id,
      label: task.title,
      meta: task.status,
      href: `/ops/execution?employee=${encodeURIComponent(snapshot.employee.id)}`,
    })),
  ]

  return (
    <Panel title={t.employeeWorkspace.sections.today}>
      <div className="mcProfilePanelBody acWorkspaceAgenda">
        {agendaItems.length === 0 ? (
          <p className="mcMuted">{t.employeeWorkspace.empty.today}</p>
        ) : (
          <ul className="acWorkspaceAgendaList">
            {agendaItems.map((item) => (
              <li key={item.id}>
                <Link to={item.href} className="acWorkspaceAgendaItem">
                  <span>{item.label}</span>
                  <span className="mcMono mcMuted">{item.meta}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {snapshot.pendingHandoffs.length > 0 ? (
          <div className="acWorkspaceSubsection">
            <span className="mcFieldLabel">{t.employeeWorkspace.sections.pendingHandoffs}</span>
            <div className="acHandoffList">
              {snapshot.pendingHandoffs.slice(0, 2).map((handoff) => (
                <HandoffCard key={handoff.id} handoff={handoff} compact />
              ))}
            </div>
          </div>
        ) : null}

        {snapshot.activityEvents.length > 0 ? (
          <div className="acWorkspaceSubsection">
            <span className="mcFieldLabel">{t.employeeWorkspace.sections.activity}</span>
            <ul className="acWorkspaceActivityList">
              {snapshot.activityEvents.slice(0, 5).map((event) => (
                <li key={event.id}>
                  <Link to="/ops/timeline" className="acWorkspaceActivityItem">
                    <span>{event.type}</span>
                    <span className="mcMono mcMuted">{new Date(event.createdAt).toLocaleTimeString()}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Panel>
  )
}
