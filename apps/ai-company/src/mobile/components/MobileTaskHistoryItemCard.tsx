import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n'
import type { MobileTaskHistoryItem } from '../history/mobileTaskHistoryViewModel'

type Props = {
  item: MobileTaskHistoryItem
}

function formatTimeLabel(iso: string): string | null {
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MobileTaskHistoryItemCard({ item }: Props) {
  const { t } = useI18n()
  const copy = t.mobile.taskHistory
  const timeLabel = formatTimeLabel(item.timeIso)
  const statusLabel = copy.status[item.statusLabelKey]

  return (
    <article className="acMobileTaskHistoryItemCard">
      <div className="acMobileTaskHistoryItemHead">
        <span className={`acMobileTaskHistoryItemStatus acMobileTaskHistoryItemStatus--${item.statusTone}`}>
          {statusLabel}
        </span>
        {timeLabel ? (
          <time className="acMobileTaskHistoryItemTime" dateTime={item.timeIso}>
            {timeLabel}
          </time>
        ) : null}
      </div>

      <h4 className="acMobileTaskHistoryItemTitle">{item.title}</h4>

      {item.resultPreview ? (
        <p className="acMobileTaskHistoryItemPreview">{item.resultPreview}</p>
      ) : null}

      <dl className="acMobileTaskHistoryItemMeta">
        <div className="acMobileTaskHistoryItemRow">
          <dt>{copy.fields.employee}</dt>
          <dd>{item.employeeLabel}</dd>
        </div>
        <div className="acMobileTaskHistoryItemRow">
          <dt>{copy.fields.source}</dt>
          <dd>{copy.sources[item.source]}</dd>
        </div>
      </dl>

      <div className="acMobileTaskHistoryItemActions">
        {item.reportHref ? (
          <Link to={item.reportHref} className="acMobileSecondaryBtn">
            {copy.actions.openReport}
          </Link>
        ) : null}
        {item.runtimeHref ? (
          <Link to={item.runtimeHref} className="acMobileSecondaryBtn">
            {copy.actions.openRuntime}
          </Link>
        ) : null}
      </div>
    </article>
  )
}
