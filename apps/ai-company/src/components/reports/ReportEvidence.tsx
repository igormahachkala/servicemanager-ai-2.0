import type { Report } from '../../domain/reports/report'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

export function ReportEvidence({ report }: { report: Report }) {
  const { t } = useI18n()

  if (report.evidence.length === 0) {
    return (
      <Panel title={t.reports.sections.evidence}>
        <div className="mcProfilePanelBody">
          <p className="mcMuted">{t.common.empty}</p>
        </div>
      </Panel>
    )
  }

  return (
    <Panel title={t.reports.sections.evidence}>
      <div className="mcProfilePanelBody">
        <div className="mcReportEvidenceGrid">
          {report.evidence.map((item) => (
            <div key={item.id} className="mcReportEvidenceItem">
              <span className="mcReportEvidenceKind mcMono">{t.reports.evidenceKinds[item.kind]}</span>
              <div className="mcReportEvidenceLabel">{item.label}</div>
              <div className="mcReportEvidenceValue mcMono">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}
