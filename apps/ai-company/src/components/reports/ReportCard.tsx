import { Link } from 'react-router-dom'
import type { Report } from '../../domain/reports/report'
import { REPORT_TYPE_META } from '../../domain/reports/reportTypes'
import { resolveEmployee } from '../../mission-control/data/conversation'
import { useI18n } from '../../i18n'

export function ReportCard({ report }: { report: Report }) {
  const { t } = useI18n()
  const meta = REPORT_TYPE_META[report.type]
  const employee = report.employeeId ? resolveEmployee(report.employeeId) : null

  return (
    <article className="mcReportCard">
      <div className="mcReportCardHead">
        <span className="mcReportTypeIcon" aria-hidden>
          {meta.icon}
        </span>
        <div className="mcReportCardTitleBlock">
          <h3 className="mcReportCardTitle">{report.title}</h3>
          <div className="mcReportCardMeta mcMono mcMuted">
            {t.reports.types[report.type]} · {employee?.codename ?? t.reports.noEmployee}
          </div>
        </div>
        <span className={`mcReportStatus mcReportStatus${capitalize(report.status)}`}>
          {t.reports.status[report.status]}
        </span>
      </div>
      <p className="mcReportCardSummary">{report.summary}</p>
      <div className="mcReportCardFoot mcMono mcMuted">
        {report.findings.length} {t.reports.findingsCount} · {report.risks.length}{' '}
        {t.reports.risksCount} · {new Date(report.updatedAt).toLocaleDateString()}
      </div>
      <Link to={`/ops/reports/${report.id}`} className="mcBtn mcBtnSecondary mcBtnSmall">
        {t.reports.openReport}
      </Link>
    </article>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
