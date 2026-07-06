import { useMemo } from 'react'
import type { MaxWorkerLoopSnapshot } from '../../domain/maxWorkerLoop'
import {
  approveCursorAutomationOwnerGate,
  rejectCursorAutomationOwnerGate,
} from '../../domain/cursorAutomation/cursorAutomationOwnerApproval'
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

  const toolEntry = useMemo(
    () => getToolRegistryV1EntryById(ca.suggestedToolId ?? 'cursor-automation'),
    [ca.suggestedToolId],
  )

  if (!ca.externalExecutorRequired || !ca.plan) return null

  const plan = ca.plan
  const reasoning = snapshot.reasoning
  const expectedPr = plan.expectedPullRequest
  const canDecide =
    ca.ownerApprovalStatus === 'pending' &&
    (ca.status === 'waiting_for_owner_approval' || ca.status === 'awaiting_owner_approval')

  const handleApprove = () => {
    approveCursorAutomationOwnerGate(loopId)
    onDecision?.()
  }

  const handleReject = () => {
    rejectCursorAutomationOwnerGate(loopId)
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

      {ca.status === 'ready_for_cursor_automation' ? (
        <p className="acMaxLoopToolBranchReadyNote">{t.maxWorkerLoop.toolBranch.readyNote}</p>
      ) : null}

      {ca.ownerApprovalStatus === 'rejected' ? (
        <p className="acMaxLoopToolBranchRejectedNote">{t.maxWorkerLoop.toolBranch.rejectedNote}</p>
      ) : null}
    </section>
  )
}
