import { Link } from 'react-router-dom'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import type { MobileOwnerDecisionItem } from '../../domain/mobileOwnerDecisions'
import { useI18n } from '../../i18n'
import { MOBILE_PATHS, resolveMobileHref } from '../navigation/mobileHrefResolver'

type Props = {
  item: MobileOwnerDecisionItem
  onApprove: (item: MobileOwnerDecisionItem) => void
  onReject: (item: MobileOwnerDecisionItem) => void
}

const KIND_TONE: Record<
  MobileOwnerDecisionItem['kind'],
  'warning' | 'error' | 'info' | 'default'
> = {
  approval: 'warning',
  cursor_handoff: 'info',
  cursor_owner_gate: 'warning',
  knowledge_candidate: 'info',
  blocked_task: 'error',
  worker_loop_failed: 'error',
  delegation_plan: 'warning',
}

function formatCreatedAt(iso: string | null): string | null {
  if (!iso) return null
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MobileDecisionCard({ item, onApprove, onReject }: Props) {
  const { t } = useI18n()
  const copy = t.mobile.decisions
  const kindLabel = copy.kinds[item.kind]
  const tone = KIND_TONE[item.kind]
  const createdLabel = formatCreatedAt(item.createdAt)
  const delegation = item.delegation

  return (
    <article className="acMobileDecisionCard">
      <div className="acMobileDecisionCardHead">
        <span className={`acMobileOwnerDecisionKind acMobileOwnerDecisionKind--${tone}`}>
          {kindLabel}
        </span>
        {createdLabel ? (
          <time className="acMobileOwnerDecisionTime" dateTime={item.createdAt ?? undefined}>
            {createdLabel}
          </time>
        ) : null}
      </div>

      <h3 className="acMobileDecisionCardTitle">{item.title}</h3>

      {delegation ? (
        <dl className="acMobileDecisionCardMeta acMobileDecisionDelegationMeta">
          <div className="acMobileDecisionCardRow">
            <dt>{copy.delegation.decidedBy}</dt>
            <dd>{delegation.decidedByLabel}</dd>
          </div>
          <div className="acMobileDecisionCardRow">
            <dt>{copy.delegation.recommendedTo}</dt>
            <dd>{delegation.recommendedLabel}</dd>
          </div>
          <div className="acMobileDecisionCardRow">
            <dt>{copy.delegation.taskTitle}</dt>
            <dd>{delegation.taskTitle}</dd>
          </div>
          <div className="acMobileDecisionCardRow acMobileDecisionDelegationExplanation">
            <dt>{copy.delegation.explanation}</dt>
            <dd>{delegation.ownerExplanation}</dd>
          </div>
          <div className="acMobileDecisionCardRow">
            <dt>{copy.delegation.confidence}</dt>
            <dd>{delegation.confidenceLabel}</dd>
          </div>
          {delegation.alternatives.length > 0 ? (
            <div className="acMobileDecisionCardRow">
              <dt>{copy.delegation.alternatives}</dt>
              <dd>
                <ul className="acMobileDecisionAlternatives">
                  {delegation.alternatives.map((alt) => (
                    <li key={alt.codename}>
                      {alt.codename}
                      {alt.note ? ` — ${alt.note}` : ''}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
          {delegation.risk ? (
            <div className="acMobileDecisionCardRow">
              <dt>{copy.fields.risk}</dt>
              <dd>{delegation.risk}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <dl className="acMobileDecisionCardMeta">
          <div className="acMobileDecisionCardRow">
            <dt>{copy.fields.employee}</dt>
            <dd>{item.employeeLabel}</dd>
          </div>
          {item.reason ? (
            <div className="acMobileDecisionCardRow">
              <dt>{copy.fields.reason}</dt>
              <dd>{item.reason}</dd>
            </div>
          ) : null}
          {item.risk ? (
            <div className="acMobileDecisionCardRow">
              <dt>{copy.fields.risk}</dt>
              <dd>{item.risk}</dd>
            </div>
          ) : null}
        </dl>
      )}

      <div className="acMobileDecisionCardActions">
        {item.canApprove ? (
          <button type="button" className="acMobilePrimaryBtn" onClick={() => onApprove(item)}>
            {copy.actions.approve}
          </button>
        ) : (
          <Link to={resolveMobileHref(item.href)} className="acMobileLinkBtn">
            {copy.actions.openDetails}
          </Link>
        )}
        {item.canReject ? (
          <button type="button" className="acMobileSecondaryBtn" onClick={() => onReject(item)}>
            {copy.actions.reject}
          </button>
        ) : item.employeeId === MAX_WORKER_EMPLOYEE_ID ? (
          <Link to={MOBILE_PATHS.max} className="acMobileSecondaryLinkBtn">
            {copy.actions.openMaxMobile}
          </Link>
        ) : null}
        {delegation ? (
          <>
            <Link
              to={resolveMobileHref(delegation.recommendedEmployeeHref)}
              className="acMobileSecondaryLinkBtn"
            >
              {copy.delegation.openEmployee}
            </Link>
            {delegation.sourceTaskHref ? (
              <Link to={resolveMobileHref(delegation.sourceTaskHref)} className="acMobileSecondaryLinkBtn">
                {copy.delegation.openSourceTask}
              </Link>
            ) : null}
          </>
        ) : null}
      </div>
    </article>
  )
}
