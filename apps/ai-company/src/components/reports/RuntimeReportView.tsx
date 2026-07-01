import type { ReportSeverity, RuntimeReportBody } from '../../domain/runtimeReport/runtimeReportQuality'
import { NO_CRITICAL_ISSUES_MESSAGE } from '../../domain/runtimeReport/runtimeReportQuality'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

function severityClass(severity: ReportSeverity): string {
  return `mcReportSeverity mcReportSeverity${severity.charAt(0).toUpperCase()}${severity.slice(1)}`
}

function RiskItem({ severity, message }: { severity: ReportSeverity; message: string }) {
  const { t } = useI18n()
  const label = t.reports.runtimeReport.severity[severity]

  return (
    <li className="mcReportRuntimeRiskItem">
      <span className={severityClass(severity)}>{label}</span>
      <span>{message}</span>
    </li>
  )
}

function SectionList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="mcMuted">—</p>
  }

  return (
    <ul className="mcReportList">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

export function RuntimeReportView({ body }: { body: RuntimeReportBody }) {
  const { t } = useI18n()
  const sections = t.reports.runtimeReport.sections

  return (
    <div className="mcReportRuntimeStack">
      <Panel title={sections.briefSummary}>
        <div className="mcProfilePanelBody">
          <p className="mcReportSummaryText">{body.briefSummary}</p>
        </div>
      </Panel>

      <div className="mcProfileGrid">
        <Panel title={sections.checked}>
          <div className="mcProfilePanelBody">
            <SectionList items={body.checked} />
          </div>
        </Panel>

        <Panel title={sections.found}>
          <div className="mcProfilePanelBody">
            <SectionList items={body.found} />
          </div>
        </Panel>
      </div>

      <Panel title={sections.risks}>
        <div className="mcProfilePanelBody">
          {body.risks.length === 0 ? (
            <p className="mcReportRuntimeNoCritical">{NO_CRITICAL_ISSUES_MESSAGE}</p>
          ) : (
            <ul className="mcReportRuntimeRiskList">
              {body.risks.map((risk) => (
                <RiskItem key={`${risk.severity}-${risk.message}`} severity={risk.severity} message={risk.message} />
              ))}
            </ul>
          )}
        </div>
      </Panel>

      <div className="mcProfileGrid">
        <Panel title={sections.recommendations}>
          <div className="mcProfilePanelBody">
            <SectionList items={body.recommendations} />
          </div>
        </Panel>

        <Panel title={sections.nextStep}>
          <div className="mcProfilePanelBody">
            <p className="mcReportSummaryText">{body.nextStep || '—'}</p>
          </div>
        </Panel>
      </div>

      <Panel title={sections.ownerDecisionRequired}>
        <div className="mcProfilePanelBody">
          <p className="mcReportSummaryText">{body.ownerDecisionRequired ?? t.reports.runtimeReport.ownerDecisionNo}</p>
        </div>
      </Panel>
    </div>
  )
}

export function parseRiskSeverityFromLine(line: string): { severity: ReportSeverity | null; message: string } {
  const match = line.match(/^\[(Critical|High|Medium|Low)\]\s*(.*)$/i)
  if (!match) return { severity: null, message: line }
  return {
    severity: match[1].toLowerCase() as ReportSeverity,
    message: match[2] || line,
  }
}
