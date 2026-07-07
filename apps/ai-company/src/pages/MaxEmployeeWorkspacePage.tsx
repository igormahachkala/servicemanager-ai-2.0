import { Link } from 'react-router-dom'
import { ContextEmptyState } from '../components/empty-states'
import { MaxWorkerLoopPanel } from '../components/max-worker-loop'
import { MaxDecisionPlanPanel } from '../components/decision-plan'
import { PageGuideCard } from '../components/guided'
import { useMaxEmployeeWorkspace } from '../hooks/useMaxEmployeeWorkspace'
import { useMaxDecisionPlan } from '../hooks/useMaxDecisionPlan'
import { MAX_WORKER_EMPLOYEE_ID } from '../domain/maxWorkerLoop'
import type { MaxWorkspaceView } from '../domain/maxWorkspace'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { useI18n } from '../i18n'
import { MAX_WORKER_LOOP_SYNC_EVENT } from '../hooks/useMaxWorkerLoop'

function WorkspaceEmptyHero() {
  const { t } = useI18n()

  return (
    <div className="acMaxWorkspaceEmpty">
      <ContextEmptyState area="workspace" variant="initial" />
      <p className="acMaxWorkspaceEmptyHint">{t.maxWorkspace.empty.noLoopHint}</p>
      <div className="acMaxWorkspaceEmptyActions">
        <Link
          to={`/ops/run-task?employee=${encodeURIComponent(MAX_WORKER_EMPLOYEE_ID)}`}
          className="mcBtn mcBtnPrimary"
        >
          {t.maxWorkspace.actions.runTask}
        </Link>
        <Link to={`/ops/employees/${MAX_WORKER_EMPLOYEE_ID}`} className="mcBtn mcBtnSecondary">
          {t.maxWorkspace.actions.openProfile}
        </Link>
      </div>
    </div>
  )
}

function StatusBadge({ label }: { label: string }) {
  return <span className="acMaxWorkspaceBadge">{label}</span>
}

function FieldRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null
  return (
    <div className="acMaxWorkspaceField">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function SectionEmpty({ message }: { message: string }) {
  return <p className="acMaxWorkspaceSectionEmpty mcMuted">{message}</p>
}

function MaxWorkspaceSections({ view }: { view: MaxWorkspaceView }) {
  const { t } = useI18n()
  const s = t.maxWorkspace.sections

  return (
    <>
      <section className="acMaxWorkspaceHero">
        <div className="acMaxWorkspaceHeroMain">
          <span className="acMaxWorkspaceCodename">MAX</span>
          <h2 className="acMaxWorkspaceTaskTitle">
            {view.task?.title ?? t.maxWorkspace.empty.noTask}
          </h2>
          {view.task?.taskText ? (
            <p className="acMaxWorkspaceTaskText">{view.task.taskText}</p>
          ) : null}
        </div>
        <dl className="acMaxWorkspaceHeroMeta">
          <FieldRow label={s.workStatus} value={view.workStatus?.statusLabel} />
          <FieldRow
            label={s.thinkingModel}
            value={
              view.thinkingModel
                ? [
                    view.thinkingModel.displayName,
                    view.thinkingModel.ollamaTag ? `Ollama · ${view.thinkingModel.ollamaTag}` : null,
                    view.thinkingModel.durationMs != null
                      ? `${view.thinkingModel.durationMs} ms`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : t.maxWorkspace.empty.noModel
            }
          />
          <FieldRow
            label={s.workerLoopPhase}
            value={
              view.workerLoopPhase
                ? [view.workerLoopPhase.domainPhaseLabel, view.workerLoopPhase.uiStepLabel]
                    .filter(Boolean)
                    .join(' → ')
                : null
            }
          />
        </dl>
      </section>

      <div className="acMaxWorkspaceStatusGrid">
        <Panel title={s.externalExecutor}>
          {view.externalExecutor?.required ? (
            <dl className="acMaxWorkspaceMiniMeta">
              <FieldRow label={s.required} value={t.maxWorkspace.values.yes} />
              <FieldRow label={s.tool} value={view.externalExecutor.toolId} />
              <FieldRow label={s.reason} value={view.externalExecutor.reason} />
            </dl>
          ) : (
            <SectionEmpty message={t.maxWorkspace.empty.externalExecutor} />
          )}
        </Panel>

        <Panel title={s.ownerApproval}>
          <dl className="acMaxWorkspaceMiniMeta">
            <FieldRow label={s.status} value={view.ownerApproval?.statusLabel} />
            <FieldRow
              label={s.required}
              value={
                view.ownerApproval?.required ? t.maxWorkspace.values.yes : t.maxWorkspace.values.no
              }
            />
          </dl>
        </Panel>

        <Panel title={s.cursorAutomation}>
          {view.cursorAutomation ? (
            <dl className="acMaxWorkspaceMiniMeta">
              <FieldRow label={s.status} value={view.cursorAutomation.statusLabel} />
              {view.cursorAutomation.submitRunId ? (
                <FieldRow label={s.submitRun} value={view.cursorAutomation.submitRunId} />
              ) : null}
              {view.cursorAutomation.hasResultIntegration ? (
                <FieldRow label={s.result} value={t.maxWorkspace.values.resultReady} />
              ) : null}
            </dl>
          ) : (
            <SectionEmpty message={t.maxWorkspace.empty.cursorAutomation} />
          )}
        </Panel>
      </div>

      <Panel title={s.lastReport}>
        {view.lastReport ? (
          <div className="acMaxWorkspaceReport">
            <h3 className="acMaxWorkspaceReportTitle">{view.lastReport.title}</h3>
            <p className="mcMuted">{view.lastReport.summary}</p>
            <div className="acMaxWorkspaceReportActions">
              <Link
                to={`/ops/reports/${encodeURIComponent(view.lastReport.id)}`}
                className="mcBtn mcBtnSecondary mcBtnSm"
              >
                {t.maxWorkspace.actions.openReport}
              </Link>
              {view.runtimeRunId ? (
                <Link
                  to={`/ops/runtime/runs/${encodeURIComponent(view.runtimeRunId)}`}
                  className="mcBtn mcBtnSecondary mcBtnSm"
                >
                  {t.maxWorkspace.actions.openRun}
                </Link>
              ) : null}
            </div>
          </div>
        ) : (
          <SectionEmpty message={t.maxWorkspace.empty.lastReport} />
        )}
      </Panel>

      <div className="acMaxWorkspaceDraftGrid">
        <Panel title={s.memoryDrafts}>
          {view.memoryDrafts.length > 0 ? (
            <ul className="acMaxWorkspaceList">
              {view.memoryDrafts.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <span className="acMaxWorkspaceTag">{item.category}</span>
                  <p className="mcMuted">{item.preview}</p>
                </li>
              ))}
            </ul>
          ) : (
            <SectionEmpty message={t.maxWorkspace.empty.memoryDrafts} />
          )}
        </Panel>

        <Panel title={s.knowledgeCandidates}>
          {view.knowledgeCandidates.length > 0 ? (
            <ul className="acMaxWorkspaceList">
              {view.knowledgeCandidates.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <p className="mcMuted">{item.summary}</p>
                </li>
              ))}
            </ul>
          ) : (
            <SectionEmpty message={t.maxWorkspace.empty.knowledgeCandidates} />
          )}
        </Panel>
      </div>

      <Panel title={s.nextActions}>
        {view.nextActions.length > 0 ? (
          <ul className="acMaxWorkspaceList acMaxWorkspaceNextActions">
            {view.nextActions.map((item) => (
              <li key={item.id}>
                <StatusBadge label={item.priority} />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <SectionEmpty message={t.maxWorkspace.empty.nextActions} />
        )}
      </Panel>
    </>
  )
}

export function MaxEmployeeWorkspacePage() {
  const { t } = useI18n()
  const { loop, snapshot, view, isRunning } = useMaxEmployeeWorkspace()

  const { view: decisionPlanView } = useMaxDecisionPlan({
    loop,
    runtimeRunId: view.runtimeRunId,
    task: view.task
      ? {
          taskText: view.task.taskText,
          title: view.task.title,
          taskId: view.task.loopId,
        }
      : null,
  })

  return (
    <div className="acMaxWorkspacePage">
      <div className="mcPageHeaderRow">
        <PageHeader title={t.maxWorkspace.pageTitle} description={t.maxWorkspace.pageDescription} />
        <Link to={`/ops/employees/${MAX_WORKER_EMPLOYEE_ID}`} className="mcBtn mcBtnSecondary">
          {t.maxWorkspace.actions.openProfile}
        </Link>
        <Link
          to={`/ops/run-task?employee=${encodeURIComponent(MAX_WORKER_EMPLOYEE_ID)}`}
          className="mcBtn mcBtnPrimary"
        >
          {t.maxWorkspace.actions.runTask}
        </Link>
        {view.runtimeRunId ? (
          <Link
            to={`/ops/runtime/live?runId=${encodeURIComponent(view.runtimeRunId)}`}
            className="mcBtn mcBtnSecondary"
          >
            {t.maxWorkspace.actions.openLive}
          </Link>
        ) : null}
      </div>

      <PageGuideCard pageId="workspace" />

      {!view.hasWork ? <WorkspaceEmptyHero /> : <MaxWorkspaceSections view={view} />}

      <Panel title={t.decisionPlan.sectionTitle}>
        <MaxDecisionPlanPanel view={decisionPlanView} />
      </Panel>

      {loop ? (
        <Panel title={t.maxWorkspace.sections.workerLoopDetail}>
          <MaxWorkerLoopPanel
            loop={loop}
            snapshot={snapshot}
            compact={false}
            onApprovalDecision={() => window.dispatchEvent(new Event(MAX_WORKER_LOOP_SYNC_EVENT))}
          />
          {isRunning ? (
            <p className="acMaxWorkspaceRunningNote mcMuted">{t.maxWorkspace.runningNote}</p>
          ) : null}
        </Panel>
      ) : null}

      <p className="mcReportPrincipleNote">{t.maxWorkspace.principleNote}</p>
    </div>
  )
}
