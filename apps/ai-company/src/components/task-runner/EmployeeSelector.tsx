import { TASK_RUNNER_EMPLOYEES } from '../../domain/taskRunner'
import { useI18n } from '../../i18n'

type Props = {
  employeeId: string
  mode: string
  onChange: (employeeId: string) => void
}

export function EmployeeSelector({ employeeId, mode, onChange }: Props) {
  const { t } = useI18n()

  return (
    <div className="mcTaskRunnerSelectorGrid">
      {TASK_RUNNER_EMPLOYEES.map((employee) => {
        const active = employee.id === employeeId
        const suggested = employee.defaultModes.includes(mode as (typeof employee.defaultModes)[number])
        return (
          <button
            key={employee.id}
            type="button"
            className={`mcTaskRunnerSelectorCard ${active ? 'active' : ''}`}
            onClick={() => onChange(employee.id)}
          >
            <div className="mcTaskRunnerSelectorTitle">{employee.codename}</div>
            <div className="mcMuted">{employee.role}</div>
            {suggested ? <span className="mcTaskRunnerSuggested">{t.taskRunner.suggested}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
