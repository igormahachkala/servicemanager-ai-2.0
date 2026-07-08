import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { EmployeeOperatingDaySnapshot } from '../../domain/employeeOperatingDay'
import type { EmployeeOperatingDaySummary } from '../../domain/operatingDaySummary'
import { useI18n } from '../../i18n'

type Props = {
  snapshot: EmployeeOperatingDaySnapshot
  summary: EmployeeOperatingDaySummary | null
}

function formatWorkDuration(
  workDurationMs: number,
  hoursLabel: string,
  minutesLabel: string,
): string {
  const totalMinutes = Math.round(workDurationMs / 60000)
  if (totalMinutes <= 0) return `0 ${minutesLabel}`
  const hours = Math.floor(totalMinutes / 60)
  const rest = totalMinutes % 60
  if (hours === 0) return `${rest} ${minutesLabel}`
  if (rest === 0) return `${hours} ${hoursLabel}`
  return `${hours} ${hoursLabel} ${rest} ${minutesLabel}`
}

function StatusBadge(props: { status: EmployeeOperatingDaySnapshot['status'] }) {
  const { t } = useI18n()
  const label = t.employeeOperatingDay.status[props.status]
  return (
    <span className={`acEmployeeOperatingDayStatus acEmployeeOperatingDayStatus--${props.status}`}>
      {label}
    </span>
  )
}

function SummaryMetric(props: { label: string; value: string }) {
  return (
    <div className="acEmployeeOperatingDaySummaryMetric">
      <div className="acEmployeeOperatingDaySummaryMetricLabel">{props.label}</div>
      <div className="acEmployeeOperatingDaySummaryMetricValue">{props.value}</div>
    </div>
  )
}

function SummarySection(props: { title: string; empty: string; children: ReactNode }) {
  return (
    <div className="acEmployeeOperatingDaySummarySection">
      <h4 className="acEmployeeOperatingDaySummarySectionTitle">{props.title}</h4>
      {props.children ?? <p className="acMuted">{props.empty}</p>}
    </div>
  )
}

export function EmployeeOperatingDaySummaryPanel(props: Props) {
  const { t } = useI18n()
  const eod = t.employeeOperatingDay
  const summaryLabels = eod.operatingDaySummary
  const { snapshot, summary } = props

  return (
    <section className="acEmployeeOperatingDayPanel acEmployeeOperatingDaySummaryPanel">
      <h3 className="acEmployeeOperatingDayPanelTitle">{summaryLabels.title}</h3>

      {!summary ? (
        <p className="acMuted acEmployeeOperatingDaySummaryEmpty">{summaryLabels.empty}</p>
      ) : (
        <div className="acEmployeeOperatingDaySummaryBody">
          <div className="acEmployeeOperatingDaySummaryStatusRow">
            <span className="acEmployeeOperatingDaySummaryStatusLabel">{summaryLabels.dayStatus}</span>
            <StatusBadge status={snapshot.status} />
          </div>

          <div className="acEmployeeOperatingDaySummaryMetrics">
            <SummaryMetric
              label={summaryLabels.tasksCompleted}
              value={String(summary.tasksCompletedCount)}
            />
            <SummaryMetric
              label={summaryLabels.tasksRemaining}
              value={String(summary.tasksRemainingCount)}
            />
            <SummaryMetric
              label={summaryLabels.tasksBlocked}
              value={String(summary.tasksBlockedCount)}
            />
            <SummaryMetric
              label={summaryLabels.workDuration}
              value={formatWorkDuration(summary.workDurationMs, eod.hoursShort, eod.minutesShort)}
            />
          </div>

          <SummarySection
            title={summaryLabels.decisions}
            empty={summaryLabels.noItems}
          >
            {summary.decisionsMade.length > 0 ? (
              <ul className="acEmployeeOperatingDaySummaryList">
                {summary.decisionsMade.map((decision, index) => (
                  <li key={`${decision.summary}-${index}`}>
                    <span>{decision.summary}</span>
                    {decision.rationale ? (
                      <span className="acMuted"> — {decision.rationale}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </SummarySection>

          <SummarySection title={summaryLabels.models} empty={summaryLabels.noItems}>
            {summary.modelsUsed.length > 0 ? (
              <ul className="acEmployeeOperatingDaySummaryList">
                {summary.modelsUsed.map((model) => (
                  <li key={`${model.modelId}-${model.role}`}>
                    <span>{model.label}</span>
                    <span className="acMuted">
                      {' '}
                      ({model.role}) · {summaryLabels.usageCount.replace('{count}', String(model.usageCount))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </SummarySection>

          <SummarySection title={summaryLabels.tools} empty={summaryLabels.noItems}>
            {summary.toolsUsed.length > 0 ? (
              <ul className="acEmployeeOperatingDaySummaryList">
                {summary.toolsUsed.map((tool) => (
                  <li key={tool.toolId}>
                    <span>{tool.label}</span>
                    <span className="acMuted">
                      {' '}
                      · {summaryLabels.usageCount.replace('{count}', String(tool.usageCount))}
                    </span>
                    {tool.reason ? <span className="acMuted"> — {tool.reason}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </SummarySection>

          <SummarySection title={summaryLabels.consultations} empty={summaryLabels.noItems}>
            {summary.consultations.length > 0 ? (
              <ul className="acEmployeeOperatingDaySummaryList">
                {summary.consultations.map((consultation, index) => (
                  <li key={`${consultation.peerEmployeeId}-${index}`}>
                    <span>{consultation.peerDisplayName ?? consultation.peerEmployeeId}</span>
                    {consultation.reason ? (
                      <span className="acMuted"> — {consultation.reason}</span>
                    ) : null}
                    {consultation.outcome ? (
                      <span className="acMuted"> · {consultation.outcome}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </SummarySection>

          <SummarySection title={summaryLabels.reportsCreated} empty={summaryLabels.noItems}>
            {summary.reportsCreated.length > 0 ? (
              <ul className="acEmployeeOperatingDaySummaryList">
                {summary.reportsCreated.map((report) => (
                  <li key={report.reportId}>
                    {report.href ? (
                      <Link to={report.href} className="acEmployeeOperatingDaySummaryLink">
                        {report.title}
                      </Link>
                    ) : (
                      <span>{report.title}</span>
                    )}
                    {report.summary ? <span className="acMuted"> — {report.summary}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </SummarySection>

          <SummarySection
            title={summaryLabels.nextDayRecommendations}
            empty={summaryLabels.noItems}
          >
            {summary.nextDayRecommendations.length > 0 ? (
              <ul className="acEmployeeOperatingDaySummaryList acEmployeeOperatingDaySummaryList--recommendations">
                {summary.nextDayRecommendations.map((recommendation, index) => (
                  <li key={`${recommendation}-${index}`}>{recommendation}</li>
                ))}
              </ul>
            ) : null}
          </SummarySection>
        </div>
      )}
    </section>
  )
}
