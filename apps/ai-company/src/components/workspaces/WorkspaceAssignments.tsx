import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Panel } from '../../mission-control/components/ui'
import { ProfileEmptyBlock } from '../../mission-control/components/ProfileEmptyBlock'
import { getDiscussionRoster, resolveRosterEntry } from '../../mission-control/data/discussion'
import type { Assignment } from '../../domain/workspaces/assignment'
import { useAssignments } from '../../hooks/useAssignments'
import { useI18n } from '../../i18n'

export function WorkspaceAssignments(props: { workspaceId: string }) {
  const { t } = useI18n()
  const { byWorkspace, create, update, remove } = useAssignments()
  const roster = useMemo(() => getDiscussionRoster(), [])
  const assignments = byWorkspace(props.workspaceId)

  const [employeeId, setEmployeeId] = useState('')
  const [role, setRole] = useState('')
  const [loadPercent, setLoadPercent] = useState(50)
  const [error, setError] = useState<string | null>(null)

  const handleAssign = (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!employeeId) {
      setError(t.workspaces.assignments.errors.employeeRequired)
      return
    }
    if (!role.trim()) {
      setError(t.workspaces.assignments.errors.roleRequired)
      return
    }

    create({
      employeeId,
      workspaceId: props.workspaceId,
      role: role.trim(),
      loadPercent,
      status: 'active',
    })

    setEmployeeId('')
    setRole('')
    setLoadPercent(50)
  }

  return (
    <div className="mcStack">
      <Panel title={t.workspaces.assignments.assignEmployee}>
        <form className="mcFormBody" onSubmit={handleAssign}>
          <div className="mcProfileFieldGrid">
            <label className="mcField">
              <span className="mcFieldLabel">{t.workspaces.assignments.selectEmployee}</span>
              <select
                className="mcInput"
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
              >
                <option value="">{t.workspaces.assignments.chooseEmployee}</option>
                {roster.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.codename} — {entry.role}
                  </option>
                ))}
              </select>
            </label>

            <label className="mcField">
              <span className="mcFieldLabel">{t.workspaces.assignments.roleLabel}</span>
              <input
                className="mcInput"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                placeholder={t.workspaces.assignments.rolePlaceholder}
              />
            </label>

            <label className="mcField">
              <span className="mcFieldLabel">{t.workspaces.assignments.loadPercent}</span>
              <input
                className="mcInput"
                type="number"
                min={0}
                max={100}
                value={loadPercent}
                onChange={(event) => setLoadPercent(Number(event.target.value))}
              />
            </label>
          </div>

          {error ? <div className="mcFormError">{error}</div> : null}

          <div className="mcFormActions">
            <button type="submit" className="mcBtn mcBtnPrimary">
              {t.workspaces.assignments.assignButton}
            </button>
          </div>
        </form>
      </Panel>

      <Panel
        title={t.workspaces.assignments.currentAssignments}
        right={
          <span className="mcMono mcMuted">
            {assignments.length} {t.workspaces.assignmentCount}
          </span>
        }
      >
        {assignments.length === 0 ? (
          <div className="mcProfilePanelBody">
            <ProfileEmptyBlock
              title={t.workspaces.assignments.emptyTitle}
              description={t.workspaces.assignments.emptyDescription}
            />
          </div>
        ) : (
          <table className="mcTable">
            <thead>
              <tr>
                <th>{t.labels.agent}</th>
                <th>{t.labels.role}</th>
                <th>{t.labels.load}</th>
                <th>{t.labels.status}</th>
                <th>{t.employees.actions}</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => (
                <AssignmentRow
                  key={assignment.id}
                  assignment={assignment}
                  onUpdate={update}
                  onRemove={remove}
                />
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}

function AssignmentRow(props: {
  assignment: Assignment
  onUpdate: (id: string, patch: Partial<Pick<Assignment, 'role' | 'loadPercent' | 'status'>>) => void
  onRemove: (id: string) => void
}) {
  const { t } = useI18n()
  const entry = resolveRosterEntry(props.assignment.employeeId)
  const codename = entry?.codename ?? props.assignment.employeeId

  return (
    <tr>
      <td>
        <span className="mcMono" style={{ fontWeight: 600 }}>
          {codename}
        </span>
        {entry?.source === 'custom' ? (
          <Link
            to={`/ops/employees/${props.assignment.employeeId}`}
            className="mcBtn mcBtnSecondary mcBtnSmall"
            style={{ marginLeft: 8 }}
          >
            {t.employees.openProfile}
          </Link>
        ) : null}
      </td>
      <td>{props.assignment.role}</td>
      <td className="mcMono">{props.assignment.loadPercent}%</td>
      <td>
        <select
          className="mcInput"
          value={props.assignment.status}
          onChange={(event) =>
            props.onUpdate(props.assignment.id, {
              status: event.target.value as Assignment['status'],
            })
          }
        >
          <option value="active">{t.workspaces.assignments.status.active}</option>
          <option value="paused">{t.workspaces.assignments.status.paused}</option>
          <option value="ended">{t.workspaces.assignments.status.ended}</option>
        </select>
      </td>
      <td>
        <button
          type="button"
          className="mcBtn mcBtnSecondary mcBtnSmall"
          onClick={() => props.onRemove(props.assignment.id)}
        >
          {t.workspaces.assignments.remove}
        </button>
      </td>
    </tr>
  )
}
