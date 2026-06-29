import { Link, useParams } from 'react-router-dom'
import {
  TaskResultReviewPanel,
  TaskResultStatusBadge,
  TaskResultTimeline,
} from '../components/task-results'
import { NextSuggestedActionsPanel } from '../components/work-scheduler'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { resolveEmployee } from '../mission-control/data/conversation'
import { useTaskResults } from '../hooks/useTaskResults'
import { useWorkScheduler } from '../hooks/useWorkScheduler'
import { useI18n } from '../i18n'

export function TaskResultDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const taskResultActions = useTaskResults()
  const result = id ? taskResultActions.getById(id) : null
  const { plan, approve, dismiss } = useWorkScheduler({ taskResultId: id ?? null })

  if (!id || !result) {
    return (
      <>
        <PageHeader title={t.taskResultEngine.notFoundTitle} description={t.taskResultEngine.notFoundDescription} />
        <Link to="/ops/task-results" className="mcBtn mcBtnPrimary">
          {t.taskResultEngine.backToList}
        </Link>
      </>
    )
  }

  const employee = resolveEmployee(result.employeeId)

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader title={result.title} description={result.summary} />
        <Link to="/ops/task-results" className="mcBtn mcBtnSecondary">
          {t.taskResultEngine.backToList}
        </Link>
        {result.runtimeRunId ? (
          <Link to={`/ops/runtime/runs/${result.runtimeRunId}`} className="mcBtn mcBtnSecondary">
            {t.taskResultEngine.openRun}
          </Link>
        ) : null}
        {result.reportId ? (
          <Link to={`/ops/reports/${result.reportId}`} className="mcBtn mcBtnSecondary">
            {t.taskResultEngine.openReport}
          </Link>
        ) : null}
        {result.handoffId ? (
          <Link to={`/ops/handoffs/${result.handoffId}`} className="mcBtn mcBtnSecondary">
            {t.taskResultEngine.openHandoff}
          </Link>
        ) : null}
        {result.followUpTaskId ? (
          <Link to="/ops/tasks" className="mcBtn mcBtnSecondary">
            {t.taskResultEngine.openFollowUp}
          </Link>
        ) : null}
        {result.projectId ? (
          <Link to={`/ops/projects/${result.projectId}`} className="mcBtn mcBtnSecondary">
            {t.taskResultEngine.openProject}
          </Link>
        ) : null}
      </div>

      <div className="acTaskResultDetailMeta">
        <TaskResultStatusBadge status={result.status} />
        <span>{employee?.codename ?? result.employeeId}</span>
        {result.taskId ? <span className="mcMono mcMuted">{result.taskId}</span> : null}
        <span className="mcMuted">{new Date(result.updatedAt).toLocaleString()}</span>
      </div>

      <Panel title={t.taskResultEngine.sections.review}>
        <div className="mcProfilePanelBody">
          <TaskResultReviewPanel
            result={result}
            onApprove={(comment) => taskResultActions.approve(result.id, comment)}
            onRequestChanges={(comment) => taskResultActions.requestChanges(result.id, comment)}
            onReject={(comment) => taskResultActions.reject(result.id, comment)}
            onFollowUp={() => taskResultActions.createFollowUp(result.id)}
            onSendQa={(comment) => taskResultActions.sendToQa(result.id, comment)}
            onSendCodex={(comment) => taskResultActions.sendToCodex(result.id, comment)}
            onArchive={(comment) => taskResultActions.archive(result.id, comment)}
          />
        </div>
      </Panel>

      <div style={{ marginTop: 16 }}>
        <Panel title={t.workScheduler.title}>
          <div className="mcProfilePanelBody">
            <NextSuggestedActionsPanel
              plan={plan}
              onApprove={approve}
              onDismiss={dismiss}
            />
          </div>
        </Panel>
      </div>

      <div className="mcGrid2" style={{ marginTop: 16 }}>
        <Panel title={t.taskResultEngine.sections.output}>
          <div className="mcProfilePanelBody acStack">
            {result.outputPreview ? <blockquote className="mcQuote">{result.outputPreview}</blockquote> : null}
            {result.findings.length > 0 ? (
              <ul className="acTaskResultFindingsList">
                {result.findings.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mcMuted">{t.taskResultEngine.noFindings}</p>
            )}
          </div>
        </Panel>

        <Panel title={t.taskResultEngine.sections.artifacts}>
          <div className="mcProfilePanelBody">
            {result.artifacts.length > 0 ? (
              <div className="acTaskResultArtifactGrid">
                {result.artifacts.map((item) => (
                  <div key={`${item.label}-${item.value}`} className="acTaskResultArtifactRow">
                    <span>{item.label}</span>
                    <span className="mcMono mcMuted">{item.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mcMuted">{t.taskResultEngine.noArtifacts}</p>
            )}
          </div>
        </Panel>
      </div>

      <div style={{ marginTop: 16 }}>
        <Panel title={t.taskResultEngine.sections.timeline}>
          <div className="mcProfilePanelBody">
            <TaskResultTimeline result={result} />
          </div>
        </Panel>
      </div>

      <p className="mcReportPrincipleNote">{t.taskResultEngine.flowNote}</p>
    </>
  )
}
