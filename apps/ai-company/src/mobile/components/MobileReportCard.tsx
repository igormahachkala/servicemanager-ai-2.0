import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n'
import type { MobileReportListItem } from '../reports/mobileReportsSnapshot'

type Props = {
  item: MobileReportListItem
}

function formatAt(iso: string): string {
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return iso
  return new Date(parsed).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MobileReportCard({ item }: Props) {
  const { t } = useI18n()
  const copy = t.mobile.reports

  return (
    <article className="acMobileReportCard">
      <div className="acMobileReportCardHead">
        <span className={`acMobileReportKind acMobileReportKind--${item.statusTone}`}>
          {copy.kinds[item.kind]}
        </span>
        <time className="acMobileReportTime" dateTime={item.at}>
          {formatAt(item.at)}
        </time>
      </div>

      <h3 className="acMobileReportCardTitle">{item.title}</h3>

      <dl className="acMobileReportCardMeta">
        <div className="acMobileReportCardRow">
          <dt>{copy.fields.employee}</dt>
          <dd>{item.employeeLabel}</dd>
        </div>
        {item.taskTitle ? (
          <div className="acMobileReportCardRow">
            <dt>{copy.fields.task}</dt>
            <dd>{item.taskTitle}</dd>
          </div>
        ) : null}
        <div className="acMobileReportCardRow">
          <dt>{copy.fields.summary}</dt>
          <dd>{item.summary}</dd>
        </div>
        <div className="acMobileReportCardRow">
          <dt>{copy.fields.status}</dt>
          <dd>
            <span className={`acMobileReportStatus acMobileReportStatus--${item.statusTone}`}>
              {copy.statuses[item.status as keyof typeof copy.statuses] ?? item.status}
            </span>
          </dd>
        </div>
      </dl>

      <Link
        to={`/mobile/reports/${encodeURIComponent(item.id)}`}
        className="acMobileLinkBtn acMobileReportCardLink"
      >
        {copy.actions.openDetail}
      </Link>
    </article>
  )
}
