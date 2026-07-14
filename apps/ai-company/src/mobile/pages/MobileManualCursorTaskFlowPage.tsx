import { Link, useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { MobileCard } from '../components/MobileCard'
import { MobileSection } from '../components/MobileSection'
import { useManualCursorTaskFlow } from '../hooks/useManualCursorTaskFlow'
import { MOBILE_PATHS } from '../navigation/mobileHrefResolver'

function toneForState(state: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  if (state === 'completed') return 'success'
  if (state === 'failed' || state === 'cancelled') return 'error'
  if (state.includes('awaiting') || state.includes('waiting')) return 'warning'
  return 'info'
}

export function MobileManualCursorTaskFlowPage() {
  const { t } = useI18n()
  const copy = t.mobile.cursorTask
  const navigate = useNavigate()
  const { runId } = useParams<{ runId?: string }>()
  const flow = useManualCursorTaskFlow(runId ?? null)

  const handleCreate = () => {
    const id = flow.createTask()
    if (id) navigate(`/mobile/cursor-task/${id}`)
  }

  return (
    <div className="acMobilePage">
      <MobileSection title={copy.title} description={copy.description}>
        {!flow.snapshot ? (
          <div className="acMobileStack">
            <label className="acMobileField">
              <span className="acMobileFieldLabel">{copy.fields.title}</span>
              <input
                className="acMobileFieldInput"
                value={flow.createForm.title}
                onChange={(event) =>
                  flow.setCreateForm({ ...flow.createForm, title: event.target.value })
                }
              />
            </label>
            <label className="acMobileField">
              <span>{copy.fields.instruction}</span>
              <textarea
                rows={4}
                value={flow.createForm.instruction}
                onChange={(event) =>
                  flow.setCreateForm({ ...flow.createForm, instruction: event.target.value })
                }
              />
            </label>
            <label className="acMobileField">
              <span>{copy.fields.expectedResult}</span>
              <textarea
                rows={2}
                value={flow.createForm.expectedResult}
                onChange={(event) =>
                  flow.setCreateForm({ ...flow.createForm, expectedResult: event.target.value })
                }
              />
            </label>
            <label className="acMobileField">
              <span>{copy.fields.repository}</span>
              <input
                value={flow.createForm.repository}
                onChange={(event) =>
                  flow.setCreateForm({ ...flow.createForm, repository: event.target.value })
                }
              />
            </label>
            <label className="acMobileField">
              <span>{copy.fields.baseBranch}</span>
              <input
                value={flow.createForm.baseBranch}
                onChange={(event) =>
                  flow.setCreateForm({ ...flow.createForm, baseBranch: event.target.value })
                }
              />
            </label>
            <p className="acMobileHint">{copy.devOnlyHint}</p>
            <button type="button" className="acMobilePrimaryBtn" onClick={handleCreate}>
              {copy.actions.createTask}
            </button>
          </div>
        ) : null}

        {flow.snapshot ? (
          <div className="acMobileStack">
            <MobileCard
              title={copy.status.title}
              description={copy.status.description}
              status={{
                label: flow.snapshot.uiStateLabel,
                tone: toneForState(flow.snapshot.uiState),
              }}
              secondaryText={`Run ${flow.snapshot.runId}`}
            />

            {flow.snapshot.routeDecision ? (
              <MobileCard title={copy.route.title} description={flow.snapshot.routeDecision.explanation}>
                <ul className="acMobileListCompact">
                  <li>
                    <strong>{copy.route.selectedRoute}:</strong> {flow.snapshot.routeDecision.selectedRoute}
                  </li>
                  <li>
                    <strong>{copy.route.cost}:</strong> {flow.snapshot.routeDecision.costClassification}
                  </li>
                  <li>
                    <strong>{copy.route.reason}:</strong> {flow.snapshot.routeDecision.reasonCode}
                  </li>
                  <li>
                    <strong>{copy.route.approval}:</strong>{' '}
                    {flow.snapshot.routeDecision.requiresOwnerApproval
                      ? copy.route.approvalRequired
                      : copy.route.approvalNotRequired}
                  </li>
                </ul>
              </MobileCard>
            ) : null}

            {flow.snapshot.canApprove ? (
              <button type="button" className="acMobilePrimaryBtn" onClick={flow.approveExecution}>
                {copy.actions.approveManual}
              </button>
            ) : null}

            {flow.snapshot.taskPackage ? (
              <MobileCard
                title={copy.package.title}
                description={copy.package.description}
                actions={
                  <button type="button" className="acMobileSecondaryBtn" onClick={() => void flow.copyTaskPackage()}>
                    {copy.actions.copyPackage}
                  </button>
                }
              >
                <pre className="acMobileCodeBlock">{flow.snapshot.taskPackage}</pre>
              </MobileCard>
            ) : null}

            {flow.snapshot.canImport ? (
              <MobileCard title={copy.import.title} description={copy.import.description}>
                <div className="acMobileStack">
                  <label className="acMobileField">
                    <span>{copy.import.branch}</span>
                    <input
                      value={flow.importForm.branch}
                      onChange={(event) =>
                        flow.setImportForm({ ...flow.importForm, branch: event.target.value })
                      }
                    />
                  </label>
                  <label className="acMobileField">
                    <span>{copy.import.commitSha}</span>
                    <input
                      value={flow.importForm.commitSha}
                      onChange={(event) =>
                        flow.setImportForm({ ...flow.importForm, commitSha: event.target.value })
                      }
                    />
                  </label>
                  <label className="acMobileField">
                    <span>{copy.import.pullRequestUrl}</span>
                    <input
                      value={flow.importForm.pullRequestUrl}
                      onChange={(event) =>
                        flow.setImportForm({ ...flow.importForm, pullRequestUrl: event.target.value })
                      }
                    />
                  </label>
                  <label className="acMobileField">
                    <span>{copy.import.summary}</span>
                    <textarea
                      rows={3}
                      value={flow.importForm.summary}
                      onChange={(event) =>
                        flow.setImportForm({ ...flow.importForm, summary: event.target.value })
                      }
                    />
                  </label>
                  <label className="acMobileField">
                    <span>{copy.import.changedFiles}</span>
                    <textarea
                      rows={3}
                      value={flow.importForm.changedFilesText}
                      onChange={(event) =>
                        flow.setImportForm({ ...flow.importForm, changedFilesText: event.target.value })
                      }
                    />
                  </label>
                  <label className="acMobileField">
                    <span>{copy.import.checks}</span>
                    <textarea
                      rows={2}
                      value={flow.importForm.checksText}
                      onChange={(event) =>
                        flow.setImportForm({ ...flow.importForm, checksText: event.target.value })
                      }
                    />
                  </label>
                  <label className="acMobileField">
                    <span>{copy.import.finishedAt}</span>
                    <input
                      value={flow.importForm.finishedAt}
                      onChange={(event) =>
                        flow.setImportForm({ ...flow.importForm, finishedAt: event.target.value })
                      }
                    />
                  </label>
                  <button type="button" className="acMobilePrimaryBtn" onClick={flow.importResult}>
                    {copy.actions.importResult}
                  </button>
                </div>
              </MobileCard>
            ) : null}

            {flow.snapshot.canBuilderReview ? (
              <MobileCard title={copy.builderReview.title} description={copy.builderReview.description}>
                <div className="acMobileButtonRow">
                  <button type="button" className="acMobilePrimaryBtn" onClick={flow.acceptBuilderReview}>
                    {copy.actions.acceptBuilder}
                  </button>
                  <button type="button" className="acMobileSecondaryBtn" onClick={flow.rejectBuilderReview}>
                    {copy.actions.rejectBuilder}
                  </button>
                </div>
              </MobileCard>
            ) : null}

            {flow.snapshot.canMaxReview ? (
              <MobileCard title={copy.maxReview.title} description={copy.maxReview.description}>
                <button type="button" className="acMobilePrimaryBtn" onClick={flow.acceptMaxReview}>
                  {copy.actions.acceptMax}
                </button>
              </MobileCard>
            ) : null}

            {flow.finalReport ? (
              <MobileCard
                title={copy.finalReport.title}
                description={
                  flow.finalReport.completed ? copy.finalReport.completed : copy.finalReport.pending
                }
                status={{
                  label: flow.finalReport.completed ? copy.finalReport.completedLabel : copy.finalReport.pendingLabel,
                  tone: flow.finalReport.completed ? 'success' : 'warning',
                }}
              >
                <ul className="acMobileListCompact">
                  <li>
                    <strong>{copy.finalReport.route}:</strong> {flow.finalReport.executionRoute}
                  </li>
                  <li>
                    <strong>{copy.finalReport.branch}:</strong> {flow.finalReport.branch ?? '—'}
                  </li>
                  <li>
                    <strong>{copy.finalReport.commit}:</strong> {flow.finalReport.commitSha ?? '—'}
                  </li>
                  <li>
                    <strong>{copy.finalReport.pr}:</strong> {flow.finalReport.pullRequestUrl ?? '—'}
                  </li>
                  <li>
                    <strong>{copy.finalReport.builder}:</strong>{' '}
                    {flow.finalReport.builderReviewDecision ?? '—'}
                  </li>
                  <li>
                    <strong>{copy.finalReport.max}:</strong> {flow.finalReport.maxReviewDecision ?? '—'}
                  </li>
                  <li>
                    <strong>{copy.finalReport.next}:</strong> {flow.finalReport.nextRecommendedAction}
                  </li>
                </ul>
                {flow.finalReport.warnings.length > 0 ? (
                  <p className="acMobileWarningText">{flow.finalReport.warnings.join(' ')}</p>
                ) : null}
              </MobileCard>
            ) : null}

            <Link className="acMobileTextLink" to={MOBILE_PATHS.builderChat}>
              {copy.links.builderChat}
            </Link>
          </div>
        ) : null}

        {flow.actionError ? <p className="acMobileErrorText">{flow.actionError}</p> : null}
        {flow.actionInfo ? <p className="acMobileInfoText">{flow.actionInfo}</p> : null}
      </MobileSection>
    </div>
  )
}
