import { TASK_RUNNER_EMPLOYEES } from '../../domain/taskRunner'
import type { TaskRunnerFormState } from '../../hooks/useTaskRunner'
import { useI18n } from '../../i18n'

type Props = {
  form: TaskRunnerFormState
  derivedTitle: string
}

export function TaskRunPreview({ form, derivedTitle }: Props) {
  const { t } = useI18n()
  const employee = TASK_RUNNER_EMPLOYEES.find((item) => item.id === form.employeeId)

  return (
    <div className="mcTaskRunnerPreview">
      <div className="mcTaskRunnerPreviewRow">
        <span className="mcMuted">{t.taskRunner.preview.title}</span>
        <strong>{form.title.trim() || derivedTitle || '—'}</strong>
      </div>
      <div className="mcTaskRunnerPreviewRow">
        <span className="mcMuted">{t.taskRunner.preview.employee}</span>
        <strong>{employee ? `${employee.codename} · ${employee.role}` : form.employeeId}</strong>
      </div>
      <div className="mcTaskRunnerPreviewRow">
        <span className="mcMuted">{t.taskRunner.preview.mode}</span>
        <strong>{t.taskRunner.modes[form.mode]}</strong>
      </div>
      <div className="mcTaskRunnerPreviewRow">
        <span className="mcMuted">{t.taskRunner.preview.project}</span>
        <strong className="mcMono">{form.projectId}</strong>
      </div>
      <div className="mcTaskRunnerPreviewRow">
        <span className="mcMuted">{t.taskRunner.preview.workspace}</span>
        <strong className="mcMono">{form.workspaceId}</strong>
      </div>
      <div className="mcTaskRunnerPreviewBlock">
        <div className="mcMuted">{t.taskRunner.preview.taskExcerpt}</div>
        <pre className="mcTaskRunnerPreviewText">
          {form.taskText.trim() ? form.taskText.trim().slice(0, 480) : t.taskRunner.preview.emptyTask}
        </pre>
      </div>
    </div>
  )
}
