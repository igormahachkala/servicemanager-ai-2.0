import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  EmployeeSelector,
  MaxOwnerCommandPanel,
  ProjectSelector,
  RuntimeModelModeSelector,
  StartRunButton,
  TaskInputPanel,
  TaskModeSelector,
  TaskRunPreview,
  TaskRunnerHistory,
  TaskRunnerResult,
} from '../components/task-runner'
import { RuntimeModelRoutingPanel } from '../components/runtime/RuntimeModelRoutingPanel'
import { MaxWorkerLoopPanel } from '../components/max-worker-loop'
import {
  AI_PHOTO_LAB_PROJECT_ID,
} from '../domain/projects/aiPhotoLabIds'
import { getOrCreateRuntimeProfile } from '../domain/runtime/runtimeStorage'
import {
  MAX_WORKER_EMPLOYEE_ID,
  runAutonomousDemoScenario,
  runMaxWorkerLoopV1,
  type MaxWorkerLoopInput,
} from '../domain/maxWorkerLoop'
import {
  getMaxOwnerCommandTemplate,
  isMaxOwnerCommandTemplateId,
  type MaxOwnerCommandTemplateId,
} from '../domain/maxWorkerLoop/maxOwnerCommandTemplates'
import { DEFAULT_AUTONOMOUS_DEMO_SCENARIO_ID } from '../domain/maxWorkerLoop/autonomousDemoScenario'
import { suggestModeForEmployee, TASK_RUNNER_EMPLOYEES } from '../domain/taskRunner'
import { useMaxWorkerLoop } from '../hooks/useMaxWorkerLoop'
import { useTaskRunner, type TaskRunnerFormState } from '../hooks/useTaskRunner'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { PageGuideCard } from '../components/guided'
import { useI18n } from '../i18n'
import { useEffect, useMemo, useState } from 'react'

function toMaxLoopMode(mode: TaskRunnerFormState['mode']): NonNullable<MaxWorkerLoopInput['mode']> {
  if (mode === 'technical_audit' || mode === 'handoff_preparation' || mode === 'documentation') {
    return mode
  }
  return 'technical_audit'
}

function toMaxLoopModelMode(
  modelMode: TaskRunnerFormState['modelMode'],
): NonNullable<MaxWorkerLoopInput['modelMode']> {
  if (modelMode === 'coding' || modelMode === 'deep' || modelMode === 'fast') {
    return modelMode
  }
  return 'coding'
}

function buildMaxLiveUrl(runId: string): string {
  return `/ops/runtime/live?runId=${encodeURIComponent(runId)}&focus=maxLoop`
}

export function RunTaskPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [maxRunning, setMaxRunning] = useState(false)
  const [maxError, setMaxError] = useState<string | null>(null)
  const [maxLastRunId, setMaxLastRunId] = useState<string | null>(null)
  const [activeTemplateId, setActiveTemplateId] = useState<MaxOwnerCommandTemplateId | null>(null)

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
    setModelMode,
    setEmployeeId,
    derivedTitle,
    history,
    running,
    error,
    lastResult,
    start,
  } = useTaskRunner(initial)

  const isMaxEmployee = form.employeeId === MAX_WORKER_EMPLOYEE_ID
  const maxLoopRunId =
    maxLastRunId ?? (isMaxEmployee && lastResult?.run?.id ? lastResult.run.id : null)
  const { loop: maxLoop, snapshot: maxSnapshot, latestForMax, refresh: refreshMaxLoop } = useMaxWorkerLoop({
    runtimeRunId: maxLoopRunId,
  })
  const displayMaxLoop = maxLoop ?? (isMaxEmployee ? latestForMax : null)

  const profile = useMemo(
    () => getOrCreateRuntimeProfile(form.employeeId),
    [form.employeeId],
  )

  const runningEffective = running || maxRunning
  const canStart = form.taskText.trim().length > 0 && !runningEffective
  const displayError = isMaxEmployee ? maxError ?? error : error

  const applyOwnerTemplate = (templateId: MaxOwnerCommandTemplateId) => {
    const template = getMaxOwnerCommandTemplate(templateId)
    setActiveTemplateId(templateId)
    patchForm({
      employeeId: MAX_WORKER_EMPLOYEE_ID,
      taskText: template.input.taskText,
      title: template.input.title ?? '',
      mode: template.input.mode ?? 'technical_audit',
      modelMode: template.input.modelMode ?? 'coding',
      projectId: template.input.projectId ?? form.projectId,
      workspaceId: template.input.workspaceId ?? form.workspaceId,
      priority: template.input.priority ?? form.priority,
      expectedOutput: template.input.expectedOutput ?? '',
      constraints: template.input.constraints ?? '',
    })
  }

  useEffect(() => {
    const templateParam = searchParams.get('template')
    if (!templateParam || !isMaxOwnerCommandTemplateId(templateParam)) return
    const template = getMaxOwnerCommandTemplate(templateParam)
    setActiveTemplateId(templateParam)
    patchForm({
      employeeId: MAX_WORKER_EMPLOYEE_ID,
      taskText: template.input.taskText,
      title: template.input.title ?? '',
      mode: template.input.mode ?? 'technical_audit',
      modelMode: template.input.modelMode ?? 'coding',
      projectId: template.input.projectId ?? form.projectId,
      workspaceId: template.input.workspaceId ?? form.workspaceId,
      priority: template.input.priority ?? form.priority,
      expectedOutput: template.input.expectedOutput ?? '',
      constraints: template.input.constraints ?? '',
    })
  }, [searchParams])

  const handleEnterMaxMode = () => {
    setEmployeeId(MAX_WORKER_EMPLOYEE_ID)
    setModelMode('coding')
  }

  const handleAutonomousDemo = async () => {
    setMaxRunning(true)
    setMaxError(null)
    patchForm({
      employeeId: MAX_WORKER_EMPLOYEE_ID,
      taskText: t.maxWorkerLoop.autonomousDemo.prefillTask,
      title: t.maxWorkerLoop.autonomousDemo.prefillTitle,
      mode: 'documentation',
      modelMode: 'coding',
    })
    try {
      const { loop } = await runAutonomousDemoScenario(DEFAULT_AUTONOMOUS_DEMO_SCENARIO_ID)
      if (loop.runtimeRunId) {
        setMaxLastRunId(loop.runtimeRunId)
        navigate(buildMaxLiveUrl(loop.runtimeRunId))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Autonomous demo failed'
      setMaxError(message)
    } finally {
      setMaxRunning(false)
    }
  }

  const handleStart = async () => {
    if (isMaxEmployee) {
      setMaxRunning(true)
      setMaxError(null)
      try {
        const { loop } = await runMaxWorkerLoopV1({
          taskText: form.taskText,
          title: form.title.trim() || derivedTitle || undefined,
          mode: toMaxLoopMode(form.mode),
          modelMode: toMaxLoopModelMode(form.modelMode),
          projectId: form.projectId,
          workspaceId: form.workspaceId,
          priority: form.priority,
          expectedOutput: form.expectedOutput,
          constraints: form.constraints,
        })
        if (loop.runtimeRunId) {
          setMaxLastRunId(loop.runtimeRunId)
          navigate(buildMaxLiveUrl(loop.runtimeRunId))
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'MAX Worker Loop failed'
        setMaxError(message)
      } finally {
        setMaxRunning(false)
      }
      return
    }

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

      <PageGuideCard pageId="runTask" />

      <p className="mcTaskRunnerIntro">{t.taskRunner.intro}</p>

      <Panel title={t.maxOwnerCommand.panelTitle}>
        <div className="mcProfilePanelBody">
          <MaxOwnerCommandPanel
            profile={profile}
            modelMode={form.modelMode}
            activeTemplateId={activeTemplateId}
            isMaxMode={isMaxEmployee}
            onEnterMaxMode={handleEnterMaxMode}
            onApplyTemplate={applyOwnerTemplate}
          />
        </div>
      </Panel>

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

          <Panel title={t.runtimeModelRouting.runTaskModeTitle}>
            <div className="mcProfilePanelBody">
              <RuntimeModelModeSelector
                employeeId={form.employeeId}
                modelMode={form.modelMode}
                onChange={setModelMode}
              />
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

          {isMaxEmployee ? (
            <>
              <p className="mcMuted" style={{ marginBottom: 12 }}>
                {t.maxWorkerLoop.startNote}
              </p>
              <button
                type="button"
                className="mcBtn mcBtnSecondary"
                disabled={runningEffective}
                style={{ marginBottom: 12 }}
                onClick={() => void handleAutonomousDemo().catch(() => undefined)}
              >
                {t.maxWorkerLoop.autonomousDemo.runButton}
              </button>
              <p className="mcMuted" style={{ marginBottom: 12, fontSize: '0.85rem' }}>
                {t.maxWorkerLoop.autonomousDemo.runHint}
              </p>
            </>
          ) : null}

          <StartRunButton
            disabled={!canStart}
            running={runningEffective}
            startLabel={isMaxEmployee ? t.maxOwnerCommand.startMax : undefined}
            startNote={isMaxEmployee ? t.maxOwnerCommand.startMaxNote : undefined}
            onStart={() => void handleStart().catch(() => undefined)}
          />
          {displayError ? <p className="mcRuntimeExecutionError">{displayError}</p> : null}
        </div>

        <aside className="mcTaskRunnerAside">
          {isMaxEmployee ? (
            <Panel title={t.maxWorkerLoop.sectionTitle}>
              <div className="mcProfilePanelBody">
                <MaxWorkerLoopPanel
                  loop={displayMaxLoop}
                  snapshot={maxSnapshot}
                  compact
                  onApprovalDecision={refreshMaxLoop}
                />
              </div>
            </Panel>
          ) : null}

          <Panel title={t.taskRunner.sections.preview}>
            <div className="mcProfilePanelBody">
              <TaskRunPreview form={form} derivedTitle={derivedTitle} profile={profile} />
            </div>
          </Panel>

          <Panel title={t.runtimeModelRouting.title}>
            <div className="mcProfilePanelBody">
              <RuntimeModelRoutingPanel
                employeeId={form.employeeId}
                profile={profile}
                modelMode={form.modelMode}
                compact
              />
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
