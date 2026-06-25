import { Link } from 'react-router-dom'
import { Panel } from '../../mission-control/components/ui'
import type { EmployeePresence } from '../../domain/presence'
import { getProjectById } from '../../domain/projects/project'
import { getWorkspaceById } from '../../domain/workspaces/workspace'
import { EmployeeStatusBadge } from './EmployeeStatusBadge'
import { useI18n } from '../../i18n'

export function CurrentWorkPanel(props: { presence: EmployeePresence | null; employeeId: string }) {
  const { t } = useI18n()
  const { presence } = props

  if (!presence || presence.status === 'offline') {
    return (
      <Panel title={t.presence.currentWork.title}>
        <p className="acMuted">{t.presence.currentWork.offline}</p>
      </Panel>
    )
  }

  const project = presence.currentProjectId ? getProjectById(presence.currentProjectId) : null
  const workspace = presence.currentWorkspaceId
    ? getWorkspaceById(presence.currentWorkspaceId)
    : null

  return (
    <Panel title={t.presence.currentWork.title}>
      <div className="acPresenceCurrentWork">
        <div className="acPresenceCurrentWorkHead">
          <EmployeeStatusBadge status={presence.status} />
          <span className="acPresenceCurrentWorkActivity">{presence.activity}</span>
        </div>
        <div className="acProfileFieldGrid">
          {project ? (
            <div className="acProfileField">
              <div className="acProfileFieldLabel">{t.presence.currentWork.project}</div>
              <div className="acProfileFieldValue">
                <Link to={`/ops/projects/${project.id}`} className="acLink">
                  {project.title}
                </Link>
              </div>
            </div>
          ) : null}
          {workspace ? (
            <div className="acProfileField">
              <div className="acProfileFieldLabel">{t.presence.currentWork.workspace}</div>
              <div className="acProfileFieldValue">
                <Link to={`/ops/workspaces/${workspace.id}`} className="acLink">
                  {workspace.name}
                </Link>
              </div>
            </div>
          ) : null}
          {presence.currentTaskId ? (
            <div className="acProfileField">
              <div className="acProfileFieldLabel">{t.presence.currentWork.task}</div>
              <div className="acProfileFieldValue mcMono">{presence.currentTaskId}</div>
            </div>
          ) : null}
          {presence.currentRunId ? (
            <div className="acProfileField">
              <div className="acProfileFieldLabel">{t.presence.currentWork.run}</div>
              <div className="acProfileFieldValue">
                <Link to={`/ops/runtime/runs/${presence.currentRunId}`} className="acLink mcMono">
                  {presence.currentRunId.slice(0, 16)}
                </Link>
              </div>
            </div>
          ) : null}
          <div className="acProfileField">
            <div className="acProfileFieldLabel">{t.presence.currentWork.started}</div>
            <div className="acProfileFieldValue mcMono">
              {new Date(presence.startedAt).toLocaleString()}
            </div>
          </div>
          {presence.expectedFinish ? (
            <div className="acProfileField">
              <div className="acProfileFieldLabel">{t.presence.currentWork.expectedFinish}</div>
              <div className="acProfileFieldValue mcMono">
                {new Date(presence.expectedFinish).toLocaleString()}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  )
}
