import type { TaskRunnerFormState } from '../../hooks/useTaskRunner'
import { useI18n } from '../../i18n'

type Props = {
  form: TaskRunnerFormState
  derivedTitle: string
  onChange: (patch: Partial<TaskRunnerFormState>) => void
}

export function TaskInputPanel({ form, derivedTitle, onChange }: Props) {
  const { t } = useI18n()

  return (
    <div className="mcTaskRunnerInputStack">
      <label className="mcField">
        <span className="mcFieldLabel">{t.taskRunner.fields.taskText}</span>
        <textarea
          className="mcTextarea mcTaskRunnerTextarea"
          rows={12}
          value={form.taskText}
          onChange={(event) => onChange({ taskText: event.target.value })}
          placeholder={t.taskRunner.placeholders.taskText}
        />
      </label>

      <label className="mcField">
        <span className="mcFieldLabel">{t.taskRunner.fields.title}</span>
        <input
          className="mcInput"
          value={form.title}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder={derivedTitle || t.taskRunner.placeholders.title}
        />
        {derivedTitle && !form.title.trim() ? (
          <span className="mcMuted">{t.taskRunner.extractedTitle.replace('{title}', derivedTitle)}</span>
        ) : null}
      </label>

      <label className="mcField">
        <span className="mcFieldLabel">{t.taskRunner.fields.expectedOutput}</span>
        <textarea
          className="mcTextarea"
          rows={3}
          value={form.expectedOutput}
          onChange={(event) => onChange({ expectedOutput: event.target.value })}
        />
      </label>

      <label className="mcField">
        <span className="mcFieldLabel">{t.taskRunner.fields.constraints}</span>
        <textarea
          className="mcTextarea"
          rows={3}
          value={form.constraints}
          onChange={(event) => onChange({ constraints: event.target.value })}
        />
      </label>

      <label className="mcField">
        <span className="mcFieldLabel">{t.taskRunner.fields.priority}</span>
        <select
          className="mcSelect"
          value={form.priority}
          onChange={(event) =>
            onChange({ priority: event.target.value as TaskRunnerFormState['priority'] })
          }
        >
          {(['low', 'medium', 'high', 'critical'] as const).map((priority) => (
            <option key={priority} value={priority}>
              {t.executionEngine.priorities[priority]}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
