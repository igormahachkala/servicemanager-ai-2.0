import type { Report } from '../../domain/reports/report'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

export function ReportRisks({ report }: { report: Report }) {
  const { t } = useI18n()

  return (
    <Panel title={t.reports.sections.risks}>
      <div className="mcProfilePanelBody">
        {report.risks.length === 0 ? (
          <p className="mcMuted">{t.reports.noRisks}</p>
        ) : (
          <ul className="mcReportList mcReportRiskList">
            {report.risks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  )
}
