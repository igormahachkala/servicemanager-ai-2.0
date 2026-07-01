import type { Report } from '../../domain/reports/report'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'
import { parseRiskSeverityFromLine } from './RuntimeReportView'

export function ReportRisks({ report }: { report: Report }) {
  const { t } = useI18n()

  const risks =
    report.runtimeBody?.risks ??
    report.risks.map((item) => {
      const parsed = parseRiskSeverityFromLine(item)
      return parsed.severity
        ? { severity: parsed.severity, message: parsed.message }
        : { severity: 'medium' as const, message: item }
    })

  return (
    <Panel title={t.reports.sections.risks}>
      <div className="mcProfilePanelBody">
        {risks.length === 0 ? (
          <p className="mcMuted">{t.reports.noRisks}</p>
        ) : (
          <ul className="mcReportRuntimeRiskList">
            {risks.map((item) => (
              <li key={`${item.severity}-${item.message}`} className="mcReportRuntimeRiskItem">
                <span
                  className={`mcReportSeverity mcReportSeverity${item.severity.charAt(0).toUpperCase()}${item.severity.slice(1)}`}
                >
                  {t.reports.runtimeReport.severity[item.severity]}
                </span>
                <span>{item.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  )
}
