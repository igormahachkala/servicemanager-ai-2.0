import type { WorkPriority } from '../../domain/employeeWorkQueue'
import type { MobileComplexTaskFormState } from '../tasks/mobileComplexTaskPayload'
import { useI18n } from '../../i18n'

const PRIORITIES: WorkPriority[] = ['low', 'medium', 'high', 'critical']

type MobileComplexTaskComposerProps = {
  form: MobileComplexTaskFormState
  validationError: string | null
  submitError: string | null
  isValid: boolean
  onChange: (patch: Partial<MobileComplexTaskFormState>) => void
  onSubmit: () => void
}

export function MobileComplexTaskComposer({
  form,
  validationError,
  submitError,
  isValid,
  onChange,
  onSubmit,
}: MobileComplexTaskComposerProps) {
  const { t } = useI18n()
  const copy = t.mobile.runTask.complexForm
  const validation = t.mobile.runTask.validation
  const priorityLabels = t.mobile.runTask.priorities

  const inlineValidation =
    validationError ??
    (!isValid && !form.objective.trim()
      ? validation.emptyObjective
      : !isValid && !form.title.trim()
        ? validation.emptyComplexTitle
        : null)

  return (
    <form
      className="acMobileTaskComposer acMobileComplexTaskComposer"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
      noValidate
    >
      <label className="acMobileField">
        <span className="acMobileFieldLabel">{copy.title}</span>
        <input
          type="text"
          className="acMobileFieldInput"
          value={form.title}
          placeholder={copy.titlePlaceholder}
          aria-invalid={Boolean(inlineValidation)}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </label>

      <label className="acMobileField">
        <span className="acMobileFieldLabel">{copy.objective}</span>
        <textarea
          className="acMobileFieldTextarea"
          value={form.objective}
          placeholder={copy.objectivePlaceholder}
          rows={4}
          aria-invalid={Boolean(inlineValidation)}
          aria-describedby={
            inlineValidation || submitError ? 'mobile-complex-task-error' : undefined
          }
          onChange={(event) => onChange({ objective: event.target.value })}
        />
      </label>

      <label className="acMobileField">
        <span className="acMobileFieldLabel">{copy.context}</span>
        <textarea
          className="acMobileFieldTextarea"
          value={form.context}
          placeholder={copy.contextPlaceholder}
          rows={3}
          onChange={(event) => onChange({ context: event.target.value })}
        />
      </label>

      <label className="acMobileField">
        <span className="acMobileFieldLabel">{copy.expectedResult}</span>
        <textarea
          className="acMobileFieldTextarea"
          value={form.expectedResult}
          placeholder={copy.expectedResultPlaceholder}
          rows={3}
          onChange={(event) => onChange({ expectedResult: event.target.value })}
        />
      </label>

      <label className="acMobileField">
        <span className="acMobileFieldLabel">{copy.constraints}</span>
        <textarea
          className="acMobileFieldTextarea"
          value={form.constraints}
          placeholder={copy.constraintsPlaceholder}
          rows={2}
          onChange={(event) => onChange({ constraints: event.target.value })}
        />
      </label>

      <label className="acMobileField">
        <span className="acMobileFieldLabel">{copy.forbidden}</span>
        <textarea
          className="acMobileFieldTextarea"
          value={form.forbidden}
          placeholder={copy.forbiddenPlaceholder}
          rows={2}
          onChange={(event) => onChange({ forbidden: event.target.value })}
        />
      </label>

      <label className="acMobileField">
        <span className="acMobileFieldLabel">{copy.deadline}</span>
        <input
          type="text"
          className="acMobileFieldInput"
          value={form.deadline}
          placeholder={copy.deadlinePlaceholder}
          onChange={(event) => onChange({ deadline: event.target.value })}
        />
      </label>

      <label className="acMobileField">
        <span className="acMobileFieldLabel">{copy.priority}</span>
        <select
          className="acMobileFieldSelect"
          value={form.priority}
          onChange={(event) => onChange({ priority: event.target.value as WorkPriority })}
        >
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priorityLabels[priority]}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="acMobileComplexTaskFlags">
        <legend className="acMobileFieldLabel">{copy.deliverables}</legend>
        <label className="acMobileCheckboxField">
          <input
            type="checkbox"
            checked={form.needsReport}
            onChange={(event) => onChange({ needsReport: event.target.checked })}
          />
          <span>{copy.needsReport}</span>
        </label>
        <label className="acMobileCheckboxField">
          <input
            type="checkbox"
            checked={form.needsNextSteps}
            onChange={(event) => onChange({ needsNextSteps: event.target.checked })}
          />
          <span>{copy.needsNextSteps}</span>
        </label>
      </fieldset>

      {inlineValidation ? (
        <p id="mobile-complex-task-error" className="acMobileFieldError" role="alert">
          {inlineValidation}
        </p>
      ) : null}

      {submitError ? (
        <p className="acMobileFieldError" role="alert">
          {submitError}
        </p>
      ) : null}

      <button
        type="submit"
        className="acMobilePrimaryBtn acMobileTaskComposerSubmit"
        disabled={!isValid}
      >
        {copy.submit}
      </button>

      <p className="acMobileTaskComposerNote">{t.mobile.runTask.submitNote}</p>
    </form>
  )
}
