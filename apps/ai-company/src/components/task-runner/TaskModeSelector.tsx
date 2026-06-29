import { TASK_RUNNER_MODES, isModeSuggestedForEmployee } from '../../domain/taskRunner'
import type { TaskRunnerMode } from '../../domain/taskRunner'
import { useI18n } from '../../i18n'

type Props = {
  mode: TaskRunnerMode
  employeeId: string
  onChange: (mode: TaskRunnerMode) => void
}

export function TaskModeSelector({ mode, employeeId, onChange }: Props) {
  const { t } = useI18n()

  return (
    <div className="mcTaskRunnerModeGrid">
      {TASK_RUNNER_MODES.map((item) => {
        const active = item === mode
        const suggested = isModeSuggestedForEmployee(employeeId, item)
        return (
          <button
            key={item}
            type="button"
            className={`mcTaskRunnerModeChip ${active ? 'active' : ''}`}
            onClick={() => onChange(item)}
          >
            <span>{t.taskRunner.modes[item]}</span>
            {suggested ? <span className="mcTaskRunnerModeHint">{t.taskRunner.defaultForEmployee}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
