import { Link, useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { MobileCard } from '../components/MobileCard'
import { MobileSection } from '../components/MobileSection'
import { useBuilderAutomationTaskFlow } from '../hooks/useBuilderAutomationTaskFlow'
import { MOBILE_PATHS } from '../navigation/mobileHrefResolver'

function toneForState(state: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  if (state === 'completed') return 'success'
  if (state === 'failed' || state === 'cancelled' || state === 'timed_out') return 'error'
  if (state.includes('awaiting') || state.includes('waiting') || state === 'dispatching') return 'warning'
  return 'info'
}

export function MobileBuilderAutomationTaskFlowPage() {
  const { t } = useI18n()
  const copy = t.mobile.builderAutomation
  const navigate = useNavigate()
  const { runId } = useParams<{ runId?: string }>()
  const flow = useBuilderAutomationTaskFlow(runId ?? null)

  const handleCreate = () => {
    const id = flow.createTask()
    if (id) navigate(`/mobile/builder-automation/${id}`)
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

            {flow.snapshot.externalCorrelationId ? (
              <MobileCard title={copy.correlation.title} description={copy.correlation.description}>
                <code>{flow.snapshot.externalCorrelationId}</code>
              </MobileCard>
            ) : null}

            {flow.snapshot.routeDecision ? (
              <MobileCard title={copy.route.title} description={flow.snapshot.routeDecision.explanation}>
                <ul className="acMobileListCompact">
                  <li>
                    <strong>{copy.route.selectedRoute}:</strong>{' '}
                    {flow.snapshot.routeDecision.selectedRoute}
                  </li>
                  <li>
                    <strong>{copy.route.cost}:</strong>{' '}
                    {flow.snapshot.routeDecision.costClassification}
                  </li>
                  <li>
                    <strong>{copy.route.reason}:</strong> {flow.snapshot.routeDecision.reasonCode}
                  </li>
                </ul>
              </MobileCard>
            ) : null}

            {flow.snapshot.canApproveAndDispatch ? (
              <button
                type="button"
                className="acMobilePrimaryBtn"
                onClick={() => void flow.approveAndDispatch()}
              >
                {copy.actions.approveAndDispatch}
              </button>
            ) : null}

            {flow.snapshot.canBuilderReview ? (
              <MobileCard title={copy.builderReview.title} description={copy.builderReview.description}>
                <div className="acMobileBtnRow">
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
              <MobileCard title={copy.finalReport.title}>
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
                    <strong>{copy.finalReport.next}:</strong> {flow.finalReport.nextRecommendedAction}
                  </li>
                </ul>
              </MobileCard>
            ) : null}
          </div>
        ) : null}

        {flow.actionError ? <p className="acMobileError">{flow.actionError}</p> : null}
        {flow.actionInfo ? <p className="acMobileInfo">{flow.actionInfo}</p> : null}

        <Link className="acMobileTextLink" to={MOBILE_PATHS.today}>
          {copy.links.backToToday}
        </Link>
      </MobileSection>
    </div>
  )
}
