import { useState, type FormEvent } from 'react'
import { Panel } from '../../mission-control/components/ui'
import {
  WORKSPACE_TYPES,
  type Workspace,
  type WorkspaceStatus,
  type WorkspaceType,
} from '../../domain/workspaces/workspace'
import { useWorkspaces } from '../../hooks/useWorkspaces'
import { useI18n } from '../../i18n'

const STATUS_OPTIONS: WorkspaceStatus[] = ['draft', 'active', 'maintenance', 'archived']

export function WorkspaceSettings(props: { workspace: Workspace }) {
  const { t } = useI18n()
  const { update } = useWorkspaces()
  const [name, setName] = useState(props.workspace.name)
  const [description, setDescription] = useState(props.workspace.description)
  const [type, setType] = useState<WorkspaceType>(props.workspace.type)
  const [status, setStatus] = useState<WorkspaceStatus>(props.workspace.status)
  const [owner, setOwner] = useState(props.workspace.owner)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSaved(false)

    if (!name.trim()) {
      setError(t.workspaces.errors.nameRequired)
      return
    }

    update(props.workspace.id, {
      name: name.trim(),
      description: description.trim(),
      type,
      status,
      owner: owner.trim(),
    })
    setSaved(true)
  }

  return (
    <Panel title={t.workspaces.settings.title}>
      <form className="mcFormBody" onSubmit={handleSubmit}>
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

        {error ? <div className="mcFormError">{error}</div> : null}
        {saved ? <div className="mcFormSuccess">{t.workspaces.settings.saved}</div> : null}

        <div className="mcFormActions">
          <button type="submit" className="mcBtn mcBtnPrimary">
            {t.workspaces.settings.save}
          </button>
        </div>
      </form>
    </Panel>
  )
}
