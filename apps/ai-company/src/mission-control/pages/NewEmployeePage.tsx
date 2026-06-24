import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader, Panel } from '../components/ui'
import {
  MEMORY_SCOPE_OPTIONS,
  MODEL_OPTIONS,
  PERMISSION_CATEGORIES,
  RESTRICTION_OPTIONS,
  SKILL_OPTIONS,
  TOOL_OPTIONS,
  emptyDraft,
  optionLabel,
  type CustomEmployeeDraft,
  type CustomEmployeePermissions,
  type IntegrationPermission,
} from '../data/customEmployees'
import { EMPLOYEE_TEMPLATES, templateToDraft } from '../data/employeeTemplates'
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

function OptionCheckGrid(props: {
  options: string[]
  selected: string[]
  labelFor: (option: string) => string
  onToggle: (option: string) => void
}) {
  return (
    <div className="mcCheckGrid">
      {props.options.map((option) => (
        <label key={option} className="mcCheckLabel">
          <input
            type="checkbox"
            checked={props.selected.includes(option)}
            onChange={() => props.onToggle(option)}
          />
          {props.labelFor(option)}
        </label>
      ))}
    </div>
  )
}

export function NewEmployeePage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { addEmployee } = useCustomEmployees()
  const [draft, setDraft] = useState<CustomEmployeeDraft>(emptyDraft)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId)
    const template = EMPLOYEE_TEMPLATES.find((item) => item.id === templateId)
    if (template) {
      setDraft(templateToDraft(template))
      setError(null)
    }
  }

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
      systemPrompt: draft.systemPrompt.trim(),
      workflow: draft.workflow.trim(),
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
        <Panel title={t.employees.employeeTemplates}>
          <div className="mcFormBody">
            <p className="mcFormHint" style={{ marginTop: 0 }}>
              {t.employees.selectTemplate}
            </p>
            <div className="mcTemplateGrid">
              {EMPLOYEE_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className={`mcTemplateCard${
                    selectedTemplateId === template.id ? ' mcTemplateCardActive' : ''
                  }`}
                  onClick={() => handleTemplateSelect(template.id)}
                >
                  <span className="mcTemplateCardTitle">
                    {optionLabel(t.employees.templates, template.id)}
                  </span>
                  <span className="mcTemplateCardRole">{template.role}</span>
                  <span className="mcTemplateCardMeta">{template.primaryModel}</span>
                </button>
              ))}
            </div>
          </div>
        </Panel>

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
              <OptionCheckGrid
                options={MODEL_OPTIONS.filter((model) => model !== draft.primaryModel)}
                selected={draft.fallbackModels}
                labelFor={(option) => option}
                onToggle={(option) =>
                  setDraft({
                    ...draft,
                    fallbackModels: toggleListItem(draft.fallbackModels, option),
                  })
                }
              />
            </div>
          </div>
        </Panel>

        <Panel title={t.employeeBuilder.sections.skills}>
          <div className="mcFormBody">
            <p className="mcFormHint">{t.employeeBuilder.hints.skills}</p>
            <OptionCheckGrid
              options={[...SKILL_OPTIONS]}
              selected={draft.skills}
              labelFor={(option) => optionLabel(t.employeeBuilder.options.skills, option)}
              onToggle={(option) =>
                setDraft({ ...draft, skills: toggleListItem(draft.skills, option) })
              }
            />
          </div>
        </Panel>

        <Panel title={t.employeeBuilder.sections.tools}>
          <div className="mcFormBody">
            <OptionCheckGrid
              options={[...TOOL_OPTIONS]}
              selected={draft.tools}
              labelFor={(option) => option}
              onToggle={(option) =>
                setDraft({ ...draft, tools: toggleListItem(draft.tools, option) })
              }
            />
          </div>
        </Panel>

        <Panel title={t.employeeBuilder.sections.permissions}>
          <div className="mcFormBody mcPermList">
            {PERMISSION_CATEGORIES.map((category) => {
              if (category.key === 'productionDeploy') {
                return (
                  <PermissionRow
                    key={category.key}
                    label={t.employeeBuilder.options.permissions[category.key]}
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
                  label={t.employeeBuilder.options.permissions[category.key]}
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

        <Panel title={t.employeeBuilder.sections.restrictions}>
          <div className="mcFormBody">
            <p className="mcFormHint">{t.employeeBuilder.hints.restrictions}</p>
            <OptionCheckGrid
              options={[...RESTRICTION_OPTIONS]}
              selected={draft.restrictions}
              labelFor={(option) => optionLabel(t.employeeBuilder.options.restrictions, option)}
              onToggle={(option) =>
                setDraft({ ...draft, restrictions: toggleListItem(draft.restrictions, option) })
              }
            />
          </div>
        </Panel>

        <Panel title={t.employeeBuilder.sections.systemPrompt}>
          <div className="mcFormBody">
            <label className="mcField">
              <span className="mcFieldLabel">{t.employeeBuilder.fields.systemPrompt}</span>
              <textarea
                className="mcTextarea mcTextareaCode"
                rows={6}
                value={draft.systemPrompt}
                onChange={(event) => setDraft({ ...draft, systemPrompt: event.target.value })}
                placeholder={t.employeeBuilder.placeholders.systemPrompt}
              />
            </label>
          </div>
        </Panel>

        <Panel title={t.employeeBuilder.sections.workflow}>
          <div className="mcFormBody">
            <label className="mcField">
              <span className="mcFieldLabel">{t.employeeBuilder.fields.workflow}</span>
              <textarea
                className="mcTextarea"
                rows={4}
                value={draft.workflow}
                onChange={(event) => setDraft({ ...draft, workflow: event.target.value })}
                placeholder={t.employeeBuilder.placeholders.workflow}
              />
            </label>
          </div>
        </Panel>

        <Panel title={t.employeeBuilder.sections.memoryScope}>
          <div className="mcFormBody">
            <p className="mcFormHint">{t.employeeBuilder.hints.memoryScope}</p>
            <OptionCheckGrid
              options={[...MEMORY_SCOPE_OPTIONS]}
              selected={draft.memoryScope}
              labelFor={(option) => optionLabel(t.employeeBuilder.options.memoryScope, option)}
              onToggle={(option) =>
                setDraft({ ...draft, memoryScope: toggleListItem(draft.memoryScope, option) })
              }
            />
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
