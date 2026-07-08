import type { WorkPriority } from '../../domain/employeeWorkQueue'
import type { MobileRunTaskFormState } from '../hooks/useMobileRunTask'
import { useI18n } from '../../i18n'

const PRIORITIES: WorkPriority[] = ['low', 'medium', 'high', 'critical']

type MobileTaskComposerProps = {
  form: MobileRunTaskFormState
  validationError: string | null
  submitError: string | null
  isValid: boolean
  onChange: (patch: Partial<MobileRunTaskFormState>) => void
  onSubmit: () => void
}

export function MobileTaskComposer({
  form,
  validationError,
  submitError,
  isValid,
  onChange,
  onSubmit,
}: MobileTaskComposerProps) {
  const { t } = useI18n()
  const copy = t.mobile.runTask.form
  const validation = t.mobile.runTask.validation
  const priorityLabels = t.mobile.runTask.priorities

  const inlineValidation =
    validationError ??
    (!isValid && !form.taskText.trim() ? validation.emptyTaskText : null)

  return (
    <form
      className="acMobileTaskComposer"
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
          aria-invalid={Boolean(validationError)}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </label>

      <label className="acMobileField">
        <span className="acMobileFieldLabel">{copy.taskText}</span>
        <textarea
          className="acMobileFieldTextarea"
          value={form.taskText}
          placeholder={copy.taskTextPlaceholder}
          rows={6}
          aria-invalid={Boolean(inlineValidation)}
          aria-describedby={
            inlineValidation || submitError ? 'mobile-run-task-error' : undefined
          }
          onChange={(event) => onChange({ taskText: event.target.value })}
        />
      </label>

      {inlineValidation ? (
        <p id="mobile-run-task-error" className="acMobileFieldError" role="alert">
          {inlineValidation}
        </p>
      ) : null}

      {submitError ? (
        <p className="acMobileFieldError" role="alert">
          {submitError}
        </p>
      ) : null}

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

      <label className="acMobileField">
        <span className="acMobileFieldLabel">{copy.expectedOutput}</span>
        <textarea
          className="acMobileFieldTextarea"
          value={form.expectedOutput}
          placeholder={copy.expectedOutputPlaceholder}
          rows={3}
          onChange={(event) => onChange({ expectedOutput: event.target.value })}
        />
      </label>

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
