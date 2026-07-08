import type { WorkPriority } from '../../domain/employeeWorkQueue'
import type { MobileRunTaskFormState } from '../hooks/useMobileRunTask'
import { useI18n } from '../../i18n'

const PRIORITIES: WorkPriority[] = ['low', 'medium', 'high', 'critical']

type MobileTaskComposerProps = {
  form: MobileRunTaskFormState
  validationError: string | null
  onChange: (patch: Partial<MobileRunTaskFormState>) => void
  onSubmit: () => void
}

export function MobileTaskComposer({
  form,
  validationError,
  onChange,
  onSubmit,
}: MobileTaskComposerProps) {
  const { t } = useI18n()
  const copy = t.mobile.runTask.form
  const priorityLabels = t.mobile.runTask.priorities

  return (
    <form
      className="acMobileTaskComposer"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <label className="acMobileField">
        <span className="acMobileFieldLabel">{copy.title}</span>
        <input
          type="text"
          className="acMobileFieldInput"
          value={form.title}
          placeholder={copy.titlePlaceholder}
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
          required
          aria-invalid={Boolean(validationError)}
          aria-describedby={validationError ? 'mobile-run-task-error' : undefined}
          onChange={(event) => onChange({ taskText: event.target.value })}
        />
      </label>

      {validationError ? (
        <p id="mobile-run-task-error" className="acMobileFieldError" role="alert">
          {validationError}
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

      <button type="submit" className="acMobilePrimaryBtn acMobileTaskComposerSubmit">
        {copy.submit}
      </button>

      <p className="acMobileTaskComposerNote">{t.mobile.runTask.submitNote}</p>
    </form>
  )
}
