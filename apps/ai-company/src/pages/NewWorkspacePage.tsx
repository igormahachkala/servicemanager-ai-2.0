import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader, Panel } from '../mission-control/components/ui'
import {
  WORKSPACE_TYPES,
  type WorkspaceStatus,
  type WorkspaceType,
} from '../domain/workspaces/workspace'
import { useWorkspaces } from '../hooks/useWorkspaces'
import { useCompanies } from '../hooks/useCompanies'
import { useActiveCompany } from '../hooks/useActiveCompany'
import { setActiveWorkspaceId } from '../hooks/useActiveWorkspace'
import { useI18n } from '../i18n'

const STATUS_OPTIONS: WorkspaceStatus[] = ['draft', 'active', 'maintenance', 'archived']

export function NewWorkspacePage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { create } = useWorkspaces()
  const { companies } = useCompanies()
  const { activeId: activeCompanyId } = useActiveCompany()
  const [companyId, setCompanyId] = useState(activeCompanyId ?? companies[0]?.id ?? '')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<WorkspaceType>('general')
  const [owner, setOwner] = useState('')
  const [status, setStatus] = useState<WorkspaceStatus>('active')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError(t.workspaces.errors.nameRequired)
      return
    }

    const workspace = create({
      name: name.trim(),
      description: description.trim(),
      companyId,
      type,
      owner: owner.trim(),
      status,
    })
    setActiveWorkspaceId(workspace.id)
    navigate(`/ops/workspaces/${workspace.id}`)
  }

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader title={t.workspaces.newWorkspace} description={t.workspaces.newDescription} />
        <Link to="/ops/workspaces" className="mcBtn mcBtnSecondary">
          {t.employeeBuilder.cancel}
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="mcStack">
        <Panel title={t.workspaces.newFormTitle}>
          <div className="mcFormBody">
            <label className="mcField">
              <span className="mcFieldLabel">{t.companyEngine.fields.company}</span>
              <select
                className="mcInput"
                value={companyId}
                onChange={(event) => setCompanyId(event.target.value)}
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="mcField">
              <span className="mcFieldLabel">{t.labels.name}</span>
              <input
                className="mcInput"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t.workspaces.namePlaceholder}
              />
            </label>

            <label className="mcField">
              <span className="mcFieldLabel">{t.workspaces.overview.description}</span>
              <textarea
                className="mcTextarea"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t.workspaces.descriptionPlaceholder}
              />
            </label>

            <label className="mcField">
              <span className="mcFieldLabel">{t.workspaces.typeLabel}</span>
              <select
                className="mcInput"
                value={type}
                onChange={(event) => setType(event.target.value as WorkspaceType)}
              >
                {WORKSPACE_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {t.workspaces.type[option]}
                  </option>
                ))}
              </select>
            </label>

            <label className="mcField">
              <span className="mcFieldLabel">{t.workspaces.owner}</span>
              <input
                className="mcInput"
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
                placeholder={t.workspaces.ownerPlaceholder}
              />
            </label>

            <label className="mcField">
              <span className="mcFieldLabel">{t.labels.status}</span>
              <select
                className="mcInput"
                value={status}
                onChange={(event) => setStatus(event.target.value as WorkspaceStatus)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {t.workspaces.status[option]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Panel>

        {error ? <div className="mcFormError">{error}</div> : null}

        <div className="mcFormActions">
          <Link to="/ops/workspaces" className="mcBtn mcBtnSecondary">
            {t.employeeBuilder.cancel}
          </Link>
          <button type="submit" className="mcBtn mcBtnPrimary">
            {t.workspaces.createWorkspace}
          </button>
        </div>
      </form>
    </>
  )
}
