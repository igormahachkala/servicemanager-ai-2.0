import { Link } from 'react-router-dom'
import { Badge, Card, DataTable } from '../layout'
import type { Project } from '../../domain/projects'
import { useProjectTasks } from '../../hooks/useProjectTasks'
import { agents } from '../../mission-control/data/mock'
import { useCustomEmployees } from '../../mission-control/hooks/useCustomEmployees'
import { useI18n } from '../../i18n'

function resolveAssigneeName(
  employeeId: string,
  employees: ReturnType<typeof useCustomEmployees>['employees'],
): string {
  const custom = employees.find((item) => item.id === employeeId)
  if (custom) return custom.name
  const agent = agents.find((item) => item.id === employeeId)
  return agent?.codename ?? employeeId
}

function statusBadge(status: string): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent' {
  if (status === 'done') return 'success'
  if (status === 'in_progress') return 'accent'
  if (status === 'review') return 'warning'
  if (status === 'blocked') return 'danger'
  return 'default'
}

export function ProjectTasks({ project }: { project: Project }) {
  const { t } = useI18n()
  const { tasks } = useProjectTasks(project.id)
  const { employees } = useCustomEmployees()

  return (
    <Card title={t.projects.tasks.title}>
      <p className="acMuted" style={{ marginBottom: 16 }}>
        {t.projects.tasks.description}
      </p>
      {tasks.length === 0 ? (
        <p className="acMuted">{t.projects.tasks.empty}</p>
      ) : (
        <DataTable>
          <thead>
            <tr>
              <th>{t.labels.title}</th>
              <th>{t.labels.assignee}</th>
              <th>{t.labels.priority}</th>
              <th>{t.labels.status}</th>
              <th>{t.projects.tasks.expectedOutput}</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{task.title}</div>
                  <div className="acMono acMuted">{task.id}</div>
                </td>
                <td>
                  <Link
                    to={`/ops/employees/${encodeURIComponent(task.assigneeId)}`}
                    className="acLink"
                  >
                    {resolveAssigneeName(task.assigneeId, employees)}
                  </Link>
                </td>
                <td>
                  <Badge variant={task.priority === 'critical' ? 'danger' : task.priority === 'high' ? 'warning' : 'default'}>
                    {t.projects.taskPriority[task.priority]}
                  </Badge>
                </td>
                <td>
                  <Badge variant={statusBadge(task.status)}>
                    {t.projects.taskStatus[task.status]}
                  </Badge>
                </td>
                <td className="acMuted">{task.expectedOutput}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </Card>
  )
}
