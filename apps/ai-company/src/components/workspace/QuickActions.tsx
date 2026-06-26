import { Link } from 'react-router-dom'
import type { EmployeeWorkspaceSnapshot } from '../../hooks/useEmployeeWorkspace'
import { useI18n } from '../../i18n'

export function QuickActions({ snapshot }: { snapshot: EmployeeWorkspaceSnapshot }) {
  const { t } = useI18n()
  const primaryTask = snapshot.tasks[0] ?? null

  return (
    <div className="acWorkspaceQuickActions">
      <Link
        to={`/ops/execution?employee=${encodeURIComponent(snapshot.employee.id)}`}
        className="mcBtn mcBtnPrimary"
      >
        {t.employeeWorkspace.actions.startWork}
      </Link>
      <Link
        to={primaryTask ? `/ops/execution?employee=${encodeURIComponent(snapshot.employee.id)}` : '/ops/tasks'}
        className="mcBtn mcBtnSecondary"
      >
        {t.employeeWorkspace.actions.openTask}
      </Link>
      <Link to={`/ops/employees/${snapshot.employee.id}/runtime`} className="mcBtn mcBtnSecondary">
        {t.employeeWorkspace.actions.openRuntime}
      </Link>
      <Link to="/ops/knowledge" className="mcBtn mcBtnSecondary">
        {t.employeeWorkspace.actions.openKnowledge}
      </Link>
      <Link
        to={`/ops/chats/${encodeURIComponent(`conv:${snapshot.employee.id}`)}`}
        className="mcBtn mcBtnSecondary"
      >
        {t.employeeWorkspace.actions.openChat}
      </Link>
      <Link to="/ops/reports" className="mcBtn mcBtnSecondary">
        {t.employeeWorkspace.actions.createReport}
      </Link>
    </div>
  )
}
