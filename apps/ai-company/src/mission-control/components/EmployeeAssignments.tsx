import { Link } from 'react-router-dom'
import { Panel } from './ui'
import { ProfileEmptyBlock } from './ProfileEmptyBlock'
import { resolveRosterEntry } from '../data/discussion'
import { getWorkspaceById } from '../../domain/workspaces/workspace'
import { useAssignments } from '../../hooks/useAssignments'
import { useI18n } from '../../i18n'

export function EmployeeAssignments(props: { employeeId: string }) {
  const { t } = useI18n()
  const { byEmployee } = useAssignments()
  const assignments = byEmployee(props.employeeId)

  if (assignments.length === 0) {
    return (
      <Panel title={t.employeeProfile.sections.assignments}>
        <div className="mcProfilePanelBody">
          <ProfileEmptyBlock
            title={t.employeeProfile.assignments.emptyTitle}
            description={t.employeeProfile.assignments.emptyDescription}
          />
        </div>
      </Panel>
    )
  }

  return (
    <Panel
      title={t.employeeProfile.sections.assignments}
      right={
        <span className="mcMono mcMuted">
          {assignments.length} {t.workspaces.assignmentCount}
        </span>
      }
    >
      <table className="mcTable">
        <thead>
          <tr>
            <th>{t.workspaces.assignments.workspaceColumn}</th>
            <th>{t.labels.role}</th>
            <th>{t.labels.load}</th>
            <th>{t.labels.status}</th>
            <th>{t.employees.actions}</th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((assignment) => {
            const workspace = getWorkspaceById(assignment.workspaceId)
            const entry = resolveRosterEntry(assignment.employeeId)

            return (
              <tr key={assignment.id}>
                <td style={{ fontWeight: 600 }}>{workspace?.name ?? assignment.workspaceId}</td>
                <td>{assignment.role}</td>
                <td className="mcMono">{assignment.loadPercent}%</td>
                <td className="mcMono">{t.workspaces.assignments.status[assignment.status]}</td>
                <td>
                  {workspace ? (
                    <Link
                      to={`/ops/workspaces/${workspace.id}`}
                      className="mcBtn mcBtnSecondary mcBtnSmall"
                    >
                      {t.workspaces.openWorkspace}
                    </Link>
                  ) : (
                    <span className="mcMuted">{t.common.empty}</span>
                  )}
                  {entry ? (
                    <span className="mcMono mcMuted" style={{ marginLeft: 8, fontSize: 11 }}>
                      {entry.codename}
                    </span>
                  ) : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Panel>
  )
}
