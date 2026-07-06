import { useMemo, useState } from 'react'
import type { MaxWorkerLoopSnapshot } from '../../domain/maxWorkerLoop'
import {
  approveCursorAutomationOwnerGate,
  evaluateCursorAutomationSubmitEligibility,
  rejectCursorAutomationOwnerGate,
  submitToCursorAutomation,
} from '../../domain/cursorAutomation'
import { getToolRegistryV1EntryById } from '../../domain/toolRegistry'
import { useI18n } from '../../i18n'

type Props = {
  loopId: string
  snapshot: MaxWorkerLoopSnapshot
  compact?: boolean
  onDecision?: () => void
}

function workflowStatusLabel(
  status: string,
  labels: Record<string, string>,
): string {
  return labels[status] ?? status
}

export function MaxWorkerLoopToolBranchPanel({
  loopId,
  snapshot,
  compact = false,
  onDecision,
}: Props) {
  const { t } = useI18n()
  const ca = snapshot.cursorAutomation
  const labels = t.maxWorkerLoop.toolBranch.statusLabels
  const submitLabels = t.maxWorkerLoop.toolBranch.submit
  const [submitError, setSubmitError] = useState<string | null>(null)

  const toolEntry = useMemo(
    () => getToolRegistryV1EntryById(ca.suggestedToolId ?? 'cursor-automation'),
    [ca.suggestedToolId],
  )

  const submitEligibility = useMemo(
    () =>
      evaluateCursorAutomationSubmitEligibility({
        loop: snapshot.loop,
        cursorAutomation: ca,
      }),
    [snapshot.loop, ca],
  )

  if (!ca.externalExecutorRequired || !ca.plan) return null

  const plan = ca.plan
  const reasoning = snapshot.reasoning
  const expectedPr = plan.expectedPullRequest
  const expectedResult = ca.expectedResult ?? ca.submitRun?.handoffPayload.expectedResult ?? null
  const submitRun = ca.submitRun

  const canDecide =
    ca.ownerApprovalStatus === 'pending' &&
    (ca.status === 'waiting_for_owner_approval' || ca.status === 'awaiting_owner_approval')

  const canSubmit = submitEligibility.canSubmit && !submitRun
  const isSubmitted =
    ca.status === 'submitted_mock' ||
    ca.status === 'submitted_pending_real_adapter' ||
    ca.status === 'waiting_for_result' ||
    Boolean(submitRun)

  const handleApprove = () => {
    approveCursorAutomationOwnerGate(loopId)
    onDecision?.()
  }

  const handleReject = () => {
    rejectCursorAutomationOwnerGate(loopId)
    onDecision?.()
  }

  const handleSubmit = () => {
    setSubmitError(null)
    const result = submitToCursorAutomation({
      loop: snapshot.loop,
      cursorAutomation: ca,
    })
    if (!result.ok) {
      setSubmitError(result.errorMessage ?? submitLabels.errorGeneric)
      return
    }
    onDecision?.()
  }

  return (
    <section className="acMaxLoopToolBranch" aria-label={t.maxWorkerLoop.toolBranch.title}>
      <div className="acMaxLoopToolBranchHead">
        <h4 className="acMaxLoopToolBranchTitle">{t.maxWorkerLoop.toolBranch.title}</h4>
        <span
          className={`acMaxLoopToolBranchBadge acMaxLoopToolBranchBadge${ca.status
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join('')}`}
        >
          {workflowStatusLabel(ca.status, labels)}
        </span>
      </div>

      <p className="acMaxLoopToolBranchReasonBlock">
        <span className="acMaxLoopGuideLabel">{t.maxWorkerLoop.toolBranch.whyCursor}</span>
        {ca.needReason ?? t.maxWorkerLoop.toolBranch.defaultReason}
      </p>

      <dl className="acMaxLoopToolBranchMeta acMaxLoopToolBranchMetaGrid">
        <div>
          <dt>{t.maxWorkerLoop.toolBranch.localModels}</dt>
          <dd className="mcMono">
            {reasoning.ollamaModelTag ?? reasoning.modelId ?? '—'}
            {reasoning.durationMs != null ? ` · ${reasoning.durationMs} ms` : ''}
          </dd>
        </div>
        <div>
          <dt>{t.maxWorkerLoop.toolBranch.selectedTool}</dt>
          <dd className="mcMono">{toolEntry?.name ?? ca.suggestedToolId ?? 'cursor-automation'}</dd>
        </div>
        <div>
          <dt>{t.maxWorkerLoop.toolBranch.riskLevel}</dt>
          <dd className="mcMono">{toolEntry?.riskLevel ?? 'high'}</dd>
        </div>
        <div>
          <dt>{t.maxWorkerLoop.toolBranch.ownerApprovalStatus}</dt>
          <dd>{t.maxWorkerLoop.toolBranch.approvalStatus[ca.ownerApprovalStatus]}</dd>
        </div>
      </dl>

      {!compact ? (
        <>
          <div className="acMaxLoopToolBranchSection">
            <span className="acMaxLoopGuideLabel">{t.maxWorkerLoop.toolBranch.plannedFiles}</span>
            <ul className="acMaxLoopToolBranchList">
              {plan.fileScope.map((item) => (
                <li key={item} className="mcMono">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="acMaxLoopToolBranchSection">
            <span className="acMaxLoopGuideLabel">{t.maxWorkerLoop.toolBranch.expectedOutcome}</span>
            <p>{plan.goal}</p>
          </div>

          <div className="acMaxLoopToolBranchSection">
            <span className="acMaxLoopGuideLabel">{t.maxWorkerLoop.toolBranch.buildChecklist}</span>
            <ul className="acMaxLoopToolBranchList">
              {plan.requiredChecks.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="acMaxLoopToolBranchSection">
            <span className="acMaxLoopGuideLabel">{t.maxWorkerLoop.toolBranch.expectedPr}</span>
            <p className="mcMono acMaxLoopToolBranchPrTitle">{expectedPr.title}</p>
            <p className="mcMuted">
              {plan.repository} → {expectedPr.targetBranch}
              {plan.workingBranch !== plan.baseBranch
                ? ` · branch: ${plan.workingBranch}`
                : ''}
            </p>
            <ul className="acMaxLoopToolBranchList">
              {expectedPr.descriptionOutline.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          {ca.handoff ? (
            <details className="acMaxLoopHandoffDetails">
              <summary>{t.maxWorkerLoop.cursorAutomation.handoffPrompt}</summary>
              <pre className="acMaxLoopHandoffPre">{ca.handoff.promptMarkdown}</pre>
            </details>
          ) : null}
        </>
      ) : null}

      {canDecide ? (
        <div className="acMaxLoopToolBranchActions">
          <button type="button" className="mcBtn mcBtnPrimary mcBtnSm" onClick={handleApprove}>
            {t.maxWorkerLoop.toolBranch.actions.approve}
          </button>
          <button type="button" className="mcBtn mcBtnSecondary mcBtnSm" onClick={handleReject}>
            {t.maxWorkerLoop.toolBranch.actions.reject}
          </button>
          <button
            type="button"
            className="mcBtn mcBtnSecondary mcBtnSm"
            disabled
            title={t.maxWorkerLoop.toolBranch.actions.editPlanHint}
          >
            {t.maxWorkerLoop.toolBranch.actions.editPlan}
          </button>
        </div>
      ) : null}

      {ca.status === 'ready_for_cursor_automation' && !isSubmitted ? (
        <>
          <p className="acMaxLoopToolBranchReadyNote">{t.maxWorkerLoop.toolBranch.readyNote}</p>
          <div className="acMaxLoopToolBranchActions">
            <button
              type="button"
              className="mcBtn mcBtnPrimary mcBtnSm"
              disabled={!canSubmit}
              title={canSubmit ? undefined : submitEligibility.reasons.join(' ')}
              onClick={handleSubmit}
            >
              {submitLabels.submitButton}
            </button>
          </div>
          {!canSubmit && submitEligibility.reasons.length > 0 ? (
            <p className="acMaxLoopToolBranchSubmitBlocked mcMuted">{submitEligibility.reasons[0]}</p>
          ) : null}
          {submitError ? (
            <p className="acMaxLoopToolBranchSubmitError" role="alert">
              {submitError}
            </p>
          ) : null}
        </>
      ) : null}

      {isSubmitted && submitRun ? (
        <section className="acMaxLoopToolBranchSubmit" aria-label={submitLabels.sectionTitle}>
          <h5 className="acMaxLoopToolBranchSubmitTitle">{submitLabels.sectionTitle}</h5>
          <p className="acMaxLoopToolBranchSubmitSuccess">
            {submitRun.adapterConnected ? submitLabels.successPendingAdapter : submitLabels.successMock}
          </p>

          <dl className="acMaxLoopToolBranchMeta acMaxLoopToolBranchMetaGrid">
            <div>
              <dt>{submitLabels.statusLabel}</dt>
              <dd>{workflowStatusLabel(ca.status, labels)}</dd>
            </div>
            <div>
              <dt>{submitLabels.runIdLabel}</dt>
              <dd className="mcMono">{submitRun.runId}</dd>
            </div>
            <div>
              <dt>{submitLabels.submittedAtLabel}</dt>
              <dd className="mcMono">{new Date(submitRun.submittedAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt>{submitLabels.deliveryModeLabel}</dt>
              <dd>{submitLabels.deliveryMode[submitRun.deliveryMode]}</dd>
            </div>
          </dl>

          {expectedResult ? (
            <div className="acMaxLoopToolBranchSection">
              <span className="acMaxLoopGuideLabel">{submitLabels.expectedPrLabel}</span>
              <p className="mcMono">{expectedResult.pullRequest.title}</p>
              <p className="mcMuted mcMono">{expectedResult.pullRequest.url}</p>
            </div>
          ) : null}

          <div className="acMaxLoopToolBranchSection">
            <span className="acMaxLoopGuideLabel">{submitLabels.expectedChecksLabel}</span>
            <ul className="acMaxLoopToolBranchList">
              {submitRun.expectedChecks.map((item: string) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <details className="acMaxLoopHandoffDetails">
            <summary>{submitLabels.handoffPayloadLabel}</summary>
            <pre className="acMaxLoopHandoffPre">{submitRun.handoffPayload.promptMarkdown}</pre>
          </details>

          <p className="acMaxLoopToolBranchSubmitNext">{submitLabels.whatNext}</p>

          <div className="acMaxLoopToolBranchActions">
            <button
              type="button"
              className="mcBtn mcBtnSecondary mcBtnSm"
              disabled
              title={submitLabels.retryHint}
            >
              {submitLabels.retryButton}
            </button>
          </div>
        </section>
      ) : null}

      {ca.status === 'submit_failed' ? (
        <p className="acMaxLoopToolBranchSubmitError" role="alert">
          {submitRun?.errorMessage ?? submitLabels.errorGeneric}
        </p>
      ) : null}

      {ca.ownerApprovalStatus === 'rejected' ? (
        <p className="acMaxLoopToolBranchRejectedNote">{t.maxWorkerLoop.toolBranch.rejectedNote}</p>
      ) : null}
    </section>
  )
}
