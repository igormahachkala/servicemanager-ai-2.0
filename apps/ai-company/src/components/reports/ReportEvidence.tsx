import { Link } from 'react-router-dom'
import type { Report } from '../../domain/reports/report'
import { getRunHistoryByReportId, getRunHistoryByRuntimeRunId } from '../../domain/run/runStorage'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

function resolveRunIdForReport(report: Report): string | null {
  const byReport = getRunHistoryByReportId(report.id)
  if (byReport) return byReport.id

  for (const item of report.evidence) {
    if (item.kind !== 'artifact') continue
    const byRuntime = getRunHistoryByRuntimeRunId(item.value)
    if (byRuntime) return byRuntime.id
    if (item.value.startsWith('run-hist-')) return item.value
  }

  return null
}

export function ReportEvidence({ report }: { report: Report }) {
  const { t } = useI18n()
  const linkedRunId = resolveRunIdForReport(report)

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
        {linkedRunId ? (
          <div className="mcRunReportLinkRow">
            <span className="mcMuted">{t.runEngine.linkedRun}</span>
            <Link to={`/ops/runs/${linkedRunId}`} className="mcBtn mcBtnSecondary mcBtnSmall">
              {t.runEngine.openRun}
            </Link>
          </div>
        ) : null}
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
