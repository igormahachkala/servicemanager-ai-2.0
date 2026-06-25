import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader, Panel } from '../mission-control/components/ui'
import {
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  type ProjectPriority,
  type ProjectStatus,
} from '../domain/projects'
import { useProjects } from '../hooks/useProjects'
import { useWorkspaces } from '../hooks/useWorkspaces'
import { useI18n } from '../i18n'

export function NewProjectPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { create } = useProjects()
  const { workspaces } = useWorkspaces()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? '')
  const [owner, setOwner] = useState('')
  const [status, setStatus] = useState<ProjectStatus>('planning')
  const [priority, setPriority] = useState<ProjectPriority>('medium')
  const [deadline, setDeadline] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError(t.projects.errors.titleRequired)
      return
    }
    if (!workspaceId) {
      setError(t.projects.errors.workspaceRequired)
      return
    }

    const project = create({
      title: title.trim(),
      description: description.trim(),
      workspaceId,
      owner: owner.trim(),
      status,
      priority,
      deadline: deadline ? new Date(deadline).toISOString() : null,
    })
    navigate(`/ops/projects/${project.id}`)
  }

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader title={t.projects.newProject} description={t.projects.newDescription} />
        <Link to="/ops/projects" className="mcBtn mcBtnSecondary">
          {t.employeeBuilder.cancel}
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="mcStack">
        <Panel title={t.projects.newFormTitle}>
          <div className="mcFormBody">
            <label className="mcField">
              <span className="mcFieldLabel">{t.labels.title}</span>
              <input
                className="mcInput"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t.projects.titlePlaceholder}
              />
            </label>

            <label className="mcField">
              <span className="mcFieldLabel">{t.workspaces.overview.description}</span>
              <textarea
                className="mcTextarea"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t.projects.descriptionPlaceholder}
              />
            </label>

            <label className="mcField">
              <span className="mcFieldLabel">{t.projects.workspaceLabel}</span>
              <select
                className="mcInput"
                value={workspaceId}
                onChange={(event) => setWorkspaceId(event.target.value)}
              >
                {workspaces.length === 0 ? (
                  <option value="">{t.projects.noWorkspaces}</option>
                ) : (
                  workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="mcField">
              <span className="mcFieldLabel">{t.projects.owner}</span>
              <input
                className="mcInput"
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
                placeholder={t.projects.ownerPlaceholder}
              />
            </label>

            <label className="mcField">
              <span className="mcFieldLabel">{t.labels.status}</span>
              <select
                className="mcInput"
                value={status}
                onChange={(event) => setStatus(event.target.value as ProjectStatus)}
              >
                {PROJECT_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {t.projects.status[option]}
                  </option>
                ))}
              </select>
            </label>

            <label className="mcField">
              <span className="mcFieldLabel">{t.labels.priority}</span>
              <select
                className="mcInput"
                value={priority}
                onChange={(event) => setPriority(event.target.value as ProjectPriority)}
              >
                {PROJECT_PRIORITIES.map((option) => (
                  <option key={option} value={option}>
                    {t.projects.priority[option]}
                  </option>
                ))}
              </select>
            </label>

            <label className="mcField">
              <span className="mcFieldLabel">{t.projects.deadline}</span>
              <input
                className="mcInput"
                type="date"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
              />
            </label>
          </div>
        </Panel>

        {error ? <div className="mcFormError">{error}</div> : null}

        <div className="mcFormActions">
          <Link to="/ops/projects" className="mcBtn mcBtnSecondary">
            {t.employeeBuilder.cancel}
          </Link>
          <button type="submit" className="mcBtn mcBtnPrimary">
            {t.projects.createProject}
          </button>
        </div>
      </form>
    </>
  )
}
