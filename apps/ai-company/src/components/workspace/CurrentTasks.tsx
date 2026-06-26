import { Link } from 'react-router-dom'
import { ExecutionCard } from '../execution'
import type { EmployeeWorkspaceSnapshot } from '../../hooks/useEmployeeWorkspace'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

export function CurrentTasks({ snapshot }: { snapshot: EmployeeWorkspaceSnapshot }) {
  const { t } = useI18n()
  const primaryTask = snapshot.tasks[0] ?? null

  return (
    <Panel
      title={t.employeeWorkspace.sections.currentTasks}
      right={
        <Link
          to={`/ops/execution?employee=${encodeURIComponent(snapshot.employee.id)}`}
          className="mcBtn mcBtnSecondary mcBtnSm"
        >
          {t.employeeWorkspace.openExecution}
        </Link>
      }
    >
      <div className="mcProfilePanelBody acStack">
        {primaryTask ? (
          <div className="acWorkspaceFocusCard">
            <div className="acWorkspaceFocusLabel">{t.employeeWorkspace.fields.workingOn}</div>
            <div className="acWorkspaceFocusTitle">{primaryTask.title}</div>
            <p className="mcMuted">{primaryTask.description}</p>
            <div className="acWorkspaceFocusMeta">
              <span className="mcMono">{primaryTask.status}</span>
              <span className="mcMono">{primaryTask.priority}</span>
            </div>
          </div>
        ) : (
          <p className="mcMuted">{t.employeeWorkspace.empty.tasks}</p>
        )}

        {snapshot.tasks.length > 1 ? (
          <ul className="acWorkspaceTaskList">
            {snapshot.tasks.slice(1, 5).map((task) => (
              <li key={task.id}>
                <span>{task.title}</span>
                <span className="mcMono mcMuted">{task.status}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {snapshot.executions.length > 0 ? (
          <div className="acWorkspaceSubsection">
            <span className="mcFieldLabel">{t.employeeWorkspace.sections.recentExecutions}</span>
            <div className="acWorkspaceExecutionGrid">
              {snapshot.executions.slice(0, 3).map((execution) => (
                <ExecutionCard key={execution.id} execution={execution} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  )
}
