import type { Report } from '../../domain/reports/report'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

export function ReportActions({ report }: { report: Report }) {
  const { t } = useI18n()

  return (
    <Panel title={t.reports.sections.recommendations}>
      <div className="mcProfilePanelBody">
        {report.recommendations.length === 0 ? (
          <p className="mcMuted">{t.reports.noRecommendations}</p>
        ) : (
          <ul className="mcReportList mcReportActionList">
            {report.recommendations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        <p className="mcReportPrincipleNote">{t.reports.reportsFirstNote}</p>
      </div>
    </Panel>
  )
}
