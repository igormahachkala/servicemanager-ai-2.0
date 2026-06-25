import type { Report } from '../../domain/reports/report'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

export function ReportSummary({ report }: { report: Report }) {
  const { t } = useI18n()

  return (
    <Panel title={t.reports.sections.summary}>
      <div className="mcProfilePanelBody">
        <p className="mcReportSummaryText">{report.summary}</p>
        {report.findings.length > 0 ? (
          <>
            <h4 className="mcReportSectionLabel">{t.reports.sections.findings}</h4>
            <ul className="mcReportList">
              {report.findings.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </Panel>
  )
}
