import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { MOBILE_PATHS, resolveMobileHref } from '../navigation/mobileHrefResolver'
import type { MobileTaskCenterItemView } from '../tasks/mobileTasksCenterViewModel'

type Props = {
  item: MobileTaskCenterItemView
  highlighted?: boolean
}

function formatTimeLabel(iso: string | null): string | null {
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

export function MobileTaskCenterCard({ item, highlighted = false }: Props) {
  const { t } = useI18n()
  const copy = t.mobile.tasksCenter
  const wq = t.maxWorkspace.workQueue
  const statusLabel = wq.statuses[item.status as keyof typeof wq.statuses] ?? item.status
  const priorityLabel = wq.priorities[item.priority as keyof typeof wq.priorities] ?? item.priority
  const timeLabel = formatTimeLabel(item.timeIso)
  const runTaskHref = `/mobile/tasks/new?employee=${encodeURIComponent(item.employeeId)}`

  return (
    <article
      className={
        highlighted
          ? 'acMobileTaskCenterCard acMobileTaskCenterCardHighlighted'
          : 'acMobileTaskCenterCard'
      }
    >
      <div className="acMobileTaskCenterCardHead">
        <span className={`acMobileTaskCenterStatus acMobileTaskCenterStatus--${item.status}`}>
          {statusLabel}
        </span>
        {timeLabel ? (
          <time className="acMobileTaskCenterTime" dateTime={item.timeIso ?? undefined}>
            {timeLabel}
          </time>
        ) : null}
      </div>

      <h3 className="acMobileTaskCenterTitle">{item.title}</h3>

      <dl className="acMobileTaskCenterMeta">
        <div className="acMobileTaskCenterRow">
          <dt>{copy.fields.employee}</dt>
          <dd>{item.employeeLabel}</dd>
        </div>
        <div className="acMobileTaskCenterRow">
          <dt>{copy.fields.priority}</dt>
          <dd>{priorityLabel}</dd>
        </div>
        <div className="acMobileTaskCenterRow">
          <dt>{copy.fields.status}</dt>
          <dd>{statusLabel}</dd>
        </div>
        <div className="acMobileTaskCenterRow acMobileTaskCenterRowFull">
          <dt>{copy.fields.nextStep}</dt>
          <dd>{item.nextRecommendation}</dd>
        </div>
      </dl>

      <div className="acMobileTaskCenterActions">
        <Link to={runTaskHref} className="acMobileSecondaryBtn">
          {copy.actions.assignTask}
        </Link>
        {item.isMax ? (
          <Link to={MOBILE_PATHS.max} className="acMobileSecondaryBtn">
            {copy.actions.openMax}
          </Link>
        ) : null}
        {item.reportHref ? (
          <Link to={resolveMobileHref(item.reportHref)} className="acMobileLinkBtn">
            {copy.actions.openReport}
          </Link>
        ) : null}
        <button type="button" className="acMobileTertiaryLinkBtn" disabled title={copy.actions.retryHint}>
          {copy.actions.retry}
        </button>
      </div>
    </article>
  )
}
