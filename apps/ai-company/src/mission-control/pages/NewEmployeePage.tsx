import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader, Panel } from '../components/ui'
import {
  MODEL_OPTIONS,
  PERMISSION_CATEGORIES,
  TOOL_OPTIONS,
  emptyDraft,
  type CustomEmployeeDraft,
  type CustomEmployeePermissions,
  type IntegrationPermission,
} from '../data/customEmployees'
import { useCustomEmployees } from '../hooks/useCustomEmployees'
import { useI18n } from '../../i18n'

function toggleListItem(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((value) => value !== item) : [...list, item]
}

function PermissionRow(props: {
  label: string
  hasWrite: boolean
  read: boolean
  write: boolean
  enabled: boolean
  onReadChange: (value: boolean) => void
  onWriteChange: (value: boolean) => void
  onEnabledChange: (value: boolean) => void
  readLabel: string
  writeLabel: string
  enabledLabel: string
}) {
  if (!props.hasWrite) {
    return (
      <div className="mcPermRow">
        <span className="mcPermLabel">{props.label}</span>
        <label className="mcCheckLabel">
          <input
            type="checkbox"
            checked={props.enabled}
            onChange={(event) => props.onEnabledChange(event.target.checked)}
          />
          {props.enabledLabel}
        </label>
      </div>
    )
  }

  return (
    <div className="mcPermRow">
      <span className="mcPermLabel">{props.label}</span>
      <div className="mcPermToggles">
        <label className="mcCheckLabel">
          <input
            type="checkbox"
            checked={props.read}
            onChange={(event) => props.onReadChange(event.target.checked)}
          />
          {props.readLabel}
        </label>
        <label className="mcCheckLabel">
          <input
            type="checkbox"
            checked={props.write}
            onChange={(event) => props.onWriteChange(event.target.checked)}
          />
          {props.writeLabel}
        </label>
      </div>
    </div>
  )
}

export function NewEmployeePage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { addEmployee } = useCustomEmployees()
  const [draft, setDraft] = useState<CustomEmployeeDraft>(emptyDraft)
  const [error, setError] = useState<string | null>(null)

  const updateIntegrationPermission = (
    key: Exclude<keyof CustomEmployeePermissions, 'productionDeploy'>,
    patch: Partial<IntegrationPermission>,
  ) => {
    setDraft((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [key]: { ...(current.permissions[key] as IntegrationPermission), ...patch },
      },
    }))
  }

  const updateProductionDeploy = (enabled: boolean) => {
    setDraft((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        productionDeploy: enabled,
      },
    }))
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!draft.name.trim() || !draft.codename.trim() || !draft.role.trim()) {
      setError(t.employeeBuilder.errors.required)
      return
    }
    if (!draft.primaryModel) {
      setError(t.employeeBuilder.errors.primaryModel)
      return
    }

    addEmployee({
      ...draft,
      name: draft.name.trim(),
      codename: draft.codename.trim(),
      role: draft.role.trim(),
      description: draft.description.trim(),
    })
    navigate('/ops/employees')
  }

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader title={t.employeeBuilder.title} description={t.employeeBuilder.description} />
        <Link to="/ops/employees" className="mcBtn mcBtnSecondary">
          {t.employeeBuilder.cancel}
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="mcStack">
        <Panel title={t.employeeBuilder.sections.identity}>
          <div className="mcFormBody">
            <div className="mcFormGrid">
              <label className="mcField">
                <span className="mcFieldLabel">{t.employeeBuilder.fields.name}</span>
                <input
                  className="mcInput"
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  placeholder={t.employeeBuilder.placeholders.name}
                />
              </label>
              <label className="mcField">
                <span className="mcFieldLabel">{t.employeeBuilder.fields.codename}</span>
                <input
                  className="mcInput mcMono"
                  value={draft.codename}
                  onChange={(event) => setDraft({ ...draft, codename: event.target.value })}
                  placeholder={t.employeeBuilder.placeholders.codename}
                />
              </label>
              <label className="mcField">
                <span className="mcFieldLabel">{t.employeeBuilder.fields.role}</span>
                <input
                  className="mcInput"
                  value={draft.role}
                  onChange={(event) => setDraft({ ...draft, role: event.target.value })}
                  placeholder={t.employeeBuilder.placeholders.role}
                />
              </label>
              <label className="mcField">
                <span className="mcFieldLabel">{t.employeeBuilder.fields.status}</span>
                <select
                  className="mcSelect"
                  value={draft.status}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      status: event.target.value as CustomEmployeeDraft['status'],
                    })
                  }
                >
                  <option value="active">{t.employeeBuilder.status.active}</option>
                  <option value="planned">{t.employeeBuilder.status.planned}</option>
                  <option value="disabled">{t.employeeBuilder.status.disabled}</option>
                </select>
              </label>
            </div>
          </div>
        </Panel>

        <Panel title={t.employeeBuilder.sections.models}>
          <div className="mcFormBody">
            <label className="mcField">
              <span className="mcFieldLabel">{t.employeeBuilder.fields.primaryModel}</span>
              <select
                className="mcSelect"
                value={draft.primaryModel}
                onChange={(event) => setDraft({ ...draft, primaryModel: event.target.value })}
              >
                <option value="">{t.employeeBuilder.placeholders.selectModel}</option>
                {MODEL_OPTIONS.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>
            <div className="mcField">
              <span className="mcFieldLabel">{t.employeeBuilder.fields.fallbackModels}</span>
              <div className="mcCheckGrid">
                {MODEL_OPTIONS.filter((model) => model !== draft.primaryModel).map((model) => (
                  <label key={model} className="mcCheckLabel">
                    <input
                      type="checkbox"
                      checked={draft.fallbackModels.includes(model)}
                      onChange={() =>
                        setDraft({
                          ...draft,
                          fallbackModels: toggleListItem(draft.fallbackModels, model),
                        })
                      }
                    />
                    {model}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        <Panel title={t.employeeBuilder.sections.tools}>
          <div className="mcFormBody">
            <div className="mcCheckGrid">
              {TOOL_OPTIONS.map((tool) => (
                <label key={tool} className="mcCheckLabel">
                  <input
                    type="checkbox"
                    checked={draft.tools.includes(tool)}
                    onChange={() =>
                      setDraft({ ...draft, tools: toggleListItem(draft.tools, tool) })
                    }
                  />
                  {tool}
                </label>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title={t.employeeBuilder.sections.permissions}>
          <div className="mcFormBody mcPermList">
            {PERMISSION_CATEGORIES.map((category) => {
              if (category.key === 'productionDeploy') {
                return (
                  <PermissionRow
                    key={category.key}
                    label={category.label}
                    hasWrite={false}
                    read={false}
                    write={false}
                    enabled={draft.permissions.productionDeploy}
                    onReadChange={() => undefined}
                    onWriteChange={() => undefined}
                    onEnabledChange={(value) => updateProductionDeploy(value)}
                    readLabel={t.employeeBuilder.permissions.read}
                    writeLabel={t.employeeBuilder.permissions.write}
                    enabledLabel={t.employeeBuilder.permissions.enabled}
                  />
                )
              }

              const perm = draft.permissions[category.key] as IntegrationPermission
              return (
                <PermissionRow
                  key={category.key}
                  label={category.label}
                  hasWrite={category.hasWrite}
                  read={perm.read}
                  write={perm.write}
                  enabled={false}
                  onReadChange={(value) => updateIntegrationPermission(category.key, { read: value })}
                  onWriteChange={(value) => updateIntegrationPermission(category.key, { write: value })}
                  onEnabledChange={() => undefined}
                  readLabel={t.employeeBuilder.permissions.read}
                  writeLabel={t.employeeBuilder.permissions.write}
                  enabledLabel={t.employeeBuilder.permissions.enabled}
                />
              )
            })}
            <p className="mcFormHint">{t.employeeBuilder.permissionsHint}</p>
          </div>
        </Panel>

        <Panel title={t.employeeBuilder.sections.mission}>
          <div className="mcFormBody">
            <label className="mcField">
              <span className="mcFieldLabel">{t.employeeBuilder.fields.description}</span>
              <textarea
                className="mcTextarea"
                rows={4}
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                placeholder={t.employeeBuilder.placeholders.description}
              />
            </label>
          </div>
        </Panel>

        {error ? <div className="mcFormError">{error}</div> : null}

        <div className="mcFormActions">
          <Link to="/ops/employees" className="mcBtn mcBtnSecondary">
            {t.employeeBuilder.cancel}
          </Link>
          <button type="submit" className="mcBtn mcBtnPrimary">
            {t.employeeBuilder.submit}
          </button>
        </div>
      </form>
    </>
  )
}
