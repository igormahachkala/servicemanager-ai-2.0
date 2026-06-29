import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  EmployeeSelector,
  ProjectSelector,
  StartRunButton,
  TaskInputPanel,
  TaskModeSelector,
  TaskRunPreview,
  TaskRunnerHistory,
  TaskRunnerResult,
} from '../components/task-runner'
import {
  AI_PHOTO_LAB_PROJECT_ID,
} from '../domain/projects/aiPhotoLabIds'
import { suggestModeForEmployee, TASK_RUNNER_EMPLOYEES } from '../domain/taskRunner'
import { useTaskRunner } from '../hooks/useTaskRunner'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { useI18n } from '../i18n'

export function RunTaskPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const initial = useMemo(() => {
    const employeeId = searchParams.get('employee')
    const projectId = searchParams.get('project')
    const workspaceId = searchParams.get('workspace')
    const text = searchParams.get('text')
    const mode = searchParams.get('mode')

    return {
      ...(employeeId ? { employeeId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(workspaceId ? { workspaceId } : {}),
      ...(text ? { taskText: text } : {}),
      ...(employeeId && !mode ? { mode: suggestModeForEmployee(employeeId) } : {}),
    }
  }, [searchParams])

  const {
    form,
    patchForm,
    setMode,
    setEmployeeId,
    derivedTitle,
    history,
    running,
    error,
    lastResult,
    start,
  } = useTaskRunner(initial)

  const canStart = form.taskText.trim().length > 0 && !running

  const handleStart = async () => {
    const result = await start()
    navigate(`/ops/runtime/live?runId=${encodeURIComponent(result.run.id)}`)
  }

  return (
    <div className="mcTaskRunnerPage">
      <div className="mcPageHeaderRow">
        <PageHeader title={t.taskRunner.title} description={t.taskRunner.description} />
        <Link to="/ops/runtime/live" className="mcBtn mcBtnSecondary">
          {t.pages.runtimeLive}
        </Link>
        <Link to="/ops/execution" className="mcBtn mcBtnSecondary">
          {t.pages.execution}
        </Link>
        <Link
          to={`/ops/projects/${encodeURIComponent(AI_PHOTO_LAB_PROJECT_ID)}/control-room`}
          className="mcBtn mcBtnSecondary"
        >
          {t.pages.controlRoom}
        </Link>
      </div>

      <p className="mcTaskRunnerIntro">{t.taskRunner.intro}</p>

      <div className="mcTaskRunnerLayout">
        <div className="mcTaskRunnerMain">
          <Panel title={t.taskRunner.sections.input}>
            <div className="mcProfilePanelBody">
              <TaskInputPanel form={form} derivedTitle={derivedTitle} onChange={patchForm} />
            </div>
          </Panel>

          <Panel title={t.taskRunner.sections.employee}>
            <div className="mcProfilePanelBody">
              <EmployeeSelector employeeId={form.employeeId} mode={form.mode} onChange={setEmployeeId} />
            </div>
          </Panel>

          <Panel title={t.taskRunner.sections.mode}>
            <div className="mcProfilePanelBody">
              <TaskModeSelector mode={form.mode} employeeId={form.employeeId} onChange={setMode} />
            </div>
          </Panel>

          <Panel title={t.taskRunner.sections.project}>
            <div className="mcProfilePanelBody">
              <ProjectSelector
                projectId={form.projectId}
                workspaceId={form.workspaceId}
                onChange={patchForm}
              />
            </div>
          </Panel>

          <StartRunButton
            disabled={!canStart}
            running={running}
            onStart={() => void handleStart().catch(() => undefined)}
          />
          {error ? <p className="mcRuntimeExecutionError">{error}</p> : null}
        </div>

        <aside className="mcTaskRunnerAside">
          <Panel title={t.taskRunner.sections.preview}>
            <div className="mcProfilePanelBody">
              <TaskRunPreview form={form} derivedTitle={derivedTitle} />
            </div>
          </Panel>

          <Panel title={t.taskRunner.sections.result}>
            <div className="mcProfilePanelBody">
              <TaskRunnerResult result={lastResult} />
            </div>
          </Panel>

          <Panel title={t.taskRunner.sections.history}>
            <div className="mcProfilePanelBody">
              <TaskRunnerHistory items={history} />
            </div>
          </Panel>
        </aside>
      </div>

      <p className="mcMemoryLocalNote">{t.taskRunner.localNote}</p>
      <p className="mcMuted">
        {t.taskRunner.employeeHint.replace(
          '{names}',
          TASK_RUNNER_EMPLOYEES.map((item) => item.codename).join(' · '),
        )}
      </p>
    </div>
  )
}
