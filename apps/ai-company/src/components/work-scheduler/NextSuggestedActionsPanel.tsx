import { Link } from 'react-router-dom'
import { buildRunTaskHref, getWorkSchedulerPlanByTaskResultId } from '../../domain/workScheduler'
import type { WorkSchedulerPlan, WorkSuggestion } from '../../domain/workScheduler'
import { useI18n } from '../../i18n'

type Props = {
  plan: WorkSchedulerPlan | null
  pending?: WorkSuggestion[]
  compact?: boolean
  onApprove: (planId: string, suggestionId: string) => void
  onDismiss: (planId: string, suggestionId: string) => void
}

function resolvePlanId(plan: WorkSchedulerPlan | null, suggestion: WorkSuggestion): string {
  if (plan?.suggestions.some((item) => item.id === suggestion.id)) return plan.id
  return getWorkSchedulerPlanByTaskResultId(suggestion.taskResultId)?.id ?? ''
}

export function NextSuggestedActionsPanel({
  plan,
  pending = [],
  compact = false,
  onApprove,
  onDismiss,
}: Props) {
  const { t } = useI18n()
  const suggestions =
    plan?.suggestions.filter((item) => item.status === 'pending_approval') ?? pending

  if (suggestions.length === 0) {
    return <p className="mcMuted">{t.workScheduler.empty}</p>
  }

  return (
    <div className={`mcWorkSchedulerPanel${compact ? ' mcWorkSchedulerPanelCompact' : ''}`}>
      {plan && !compact ? (
        <p className="mcWorkSchedulerAnalysis">{plan.analysisSummary}</p>
      ) : null}
      <p className="mcWorkSchedulerNote">{t.workScheduler.ownerApprovalNote}</p>
      <ul className="mcWorkSchedulerList">
        {suggestions.map((suggestion) => {
          const planId = resolvePlanId(plan, suggestion)
          const runTaskHref = buildRunTaskHref(suggestion)
          if (!planId) return null
          return (
            <li key={suggestion.id} className="mcWorkSchedulerItem">
              <div className="mcWorkSchedulerItemHead">
                <span className="mcWorkSchedulerKind">
                  {t.workScheduler.kinds[suggestion.kind]}
                </span>
                <span className={`mcWorkSchedulerPriority mcWorkSchedulerPriority${suggestion.priority}`}>
                  {t.workScheduler.priorities[suggestion.priority]}
                </span>
              </div>
              <strong>{suggestion.title}</strong>
              <p className="mcMuted">{suggestion.rationale}</p>
              <div className="mcWorkSchedulerActions">
                <button
                  type="button"
                  className="mcBtn mcBtnPrimary"
                  onClick={() => onApprove(planId, suggestion.id)}
                >
                  {t.workScheduler.actions.approve}
                </button>
                <button
                  type="button"
                  className="mcBtn mcBtnSecondary"
                  onClick={() => onDismiss(planId, suggestion.id)}
                >
                  {t.workScheduler.actions.dismiss}
                </button>
                {runTaskHref ? (
                  <Link to={runTaskHref} className="mcBtn mcBtnSecondary">
                    {t.workScheduler.actions.openRunTask}
                  </Link>
                ) : null}
                <Link
                  to={`/ops/task-results/${encodeURIComponent(suggestion.taskResultId)}`}
                  className="mcBtn mcBtnSecondary"
                >
                  {t.workScheduler.actions.openResult}
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
