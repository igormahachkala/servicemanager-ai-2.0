import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n'
import type { OwnerMorningReportSnapshot } from '../../domain/morningReport'
import { MOBILE_MORNING_REPORT_ID } from '../reports/mobileReportConstants'

type Props = {
  snapshot: OwnerMorningReportSnapshot
}

export function MobileReportSummaryCard({ snapshot }: Props) {
  const { t } = useI18n()
  const copy = t.mobile.reports.morningHero

  return (
    <article className="acMobileReportSummaryCard">
      <div className="acMobileReportSummaryCardHead">
        <span className="acMobileReportSummaryBadge">{copy.badge}</span>
        <span className="acMobileReportSummaryPeriod">{snapshot.periodLabel}</span>
      </div>

      <h2 className="acMobileReportSummaryTitle">{copy.title}</h2>
      <p className="acMobileReportSummaryText">{snapshot.summary}</p>

      <dl className="acMobileReportSummaryStats">
        <div>
          <dt>{copy.stats.tasks}</dt>
          <dd>{snapshot.completedTasks.length}</dd>
        </div>
        <div>
          <dt>{copy.stats.reports}</dt>
          <dd>{snapshot.stats.reportsCreated}</dd>
        </div>
        <div>
          <dt>{copy.stats.loops}</dt>
          <dd>{snapshot.stats.loopsCompleted}</dd>
        </div>
      </dl>

      <Link
        to={`/mobile/reports/${encodeURIComponent(MOBILE_MORNING_REPORT_ID)}`}
        className="acMobilePrimaryBtn acMobileReportSummaryCta"
      >
        {copy.open}
      </Link>
    </article>
  )
}
