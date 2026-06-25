import type { Report } from '../../domain/reports/report'
import { REPORT_TYPE_META } from '../../domain/reports/reportTypes'
import { resolveEmployee } from '../../mission-control/data/conversation'
import { useI18n } from '../../i18n'

export function ReportHeader({ report }: { report: Report }) {
  const { t } = useI18n()
  const meta = REPORT_TYPE_META[report.type]
  const employee = report.employeeId ? resolveEmployee(report.employeeId) : null

  return (
    <header className="mcReportHeader">
      <div className="mcReportHeaderTitleRow">
        <span className="mcReportTypeIcon" aria-hidden>
          {meta.icon}
        </span>
        <div>
          <h1 className="mcReportTitle">{report.title}</h1>
          <div className="mcReportHeaderMeta mcMono mcMuted">
            {t.reports.types[report.type]} · {t.reports.status[report.status]}
            {employee ? ` · ${employee.codename}` : ''}
          </div>
        </div>
        <span className={`mcReportStatus mcReportStatus${capitalize(report.status)}`}>
          {t.reports.status[report.status]}
        </span>
      </div>
      <div className="mcReportHeaderDates mcMono mcMuted">
        {t.reports.created} {new Date(report.createdAt).toLocaleString()} · {t.reports.updated}{' '}
        {new Date(report.updatedAt).toLocaleString()}
      </div>
    </header>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
