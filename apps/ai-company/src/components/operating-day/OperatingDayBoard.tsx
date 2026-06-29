import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { OperatingDayPhaseId, OperatingDaySnapshot } from '../../domain/operatingDay'
import { MorningBrief } from '../command-center/MorningBrief'
import { useI18n } from '../../i18n'
import {
  approvalPriorityLabel,
  controlRoomRiskLevelLabel,
  providerHealthLabel,
  reportTypeLabel,
  runtimeStateLabel,
  taskStatusLabel,
} from '../../i18n/uiLabels'

type Props = {
  snapshot: OperatingDaySnapshot
}

const PHASES: OperatingDayPhaseId[] = [
  'morning',
  'employees',
  'currentWork',
  'meetings',
  'approvals',
  'runtime',
  'reports',
  'endOfDay',
]

export function OperatingDayBoard({ snapshot }: Props) {
  const { t } = useI18n()
  const od = t.operatingDayEngine

  return (
    <div className="acOperatingDayBoard">
      <aside className="acOperatingDayRail" aria-label={od.flowAria}>
        {PHASES.map((phase, index) => (
          <div key={phase} className="acOperatingDayRailStep">
            <span className="acOperatingDayRailDot" aria-hidden />
            <span className="acOperatingDayRailLabel">{od.phases[phase]}</span>
            {index < PHASES.length - 1 ? <span className="acOperatingDayRailLine" aria-hidden /> : null}
          </div>
        ))}
      </aside>

      <div className="acOperatingDaySections">
        <OperatingDaySection phase="morning" title={od.sections.morningBrief}>
          <MorningBrief brief={snapshot.brief} healthScore={snapshot.healthScore} />
        </OperatingDaySection>

        <OperatingDaySection phase="morning" title={od.sections.priorities}>
          {snapshot.priorities.length === 0 ? (
            <p className="acMuted">{od.empty.priorities}</p>
          ) : (
            <ul className="acOperatingDayList">
              {snapshot.priorities.map((item) => (
                <li key={item.id} className="acOperatingDayListRow">
                  <div>
                    <div className="acOperatingDayListTitle">{item.label}</div>
                    <div className="acMuted">{item.detail}</div>
                  </div>
                  {item.href ? (
                    <Link to={item.href} className="acLink">
                      →
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </OperatingDaySection>

        <OperatingDaySection phase="employees" title={od.sections.employeesStarted}>
          {snapshot.employeesStarted.length === 0 ? (
            <p className="acMuted">{od.empty.employeesStarted}</p>
          ) : (
            <ul className="acOperatingDayChipList">
              {snapshot.employeesStarted.map((entry) => (
                <li key={entry.workday.employeeId} className="acOperatingDayChip">
                  <Link to={`/ops/employees/${encodeURIComponent(entry.workday.employeeId)}/workspace`}>
                    {entry.employeeCodename}
                  </Link>
                  <span className="acMuted">{t.workdayEngine.phases[entry.workday.phase]}</span>
                </li>
              ))}
            </ul>
          )}
        </OperatingDaySection>

        <OperatingDaySection phase="currentWork" title={od.sections.sprintProgress}>
          {snapshot.sprint ? (
            <>
              <div className="acOperatingDaySprintGoal">{snapshot.sprint.sprint.goal}</div>
              <div className="acOperatingDayProgressMeta">
                <span>{snapshot.sprint.stats.progressPercent}%</span>
                <span>
                  {snapshot.sprint.stats.completed}/
                  {snapshot.sprint.stats.completed + snapshot.sprint.stats.remaining}{' '}
                  {t.commandCenter.sprintTasks}
                </span>
                <Link to="/ops/sprint/sprint-apl-1" className="acLink">
                  {t.sprintEngine.openSprint}
                </Link>
              </div>
              <div className="acOperatingDayProgressBar">
                <div
                  className="acOperatingDayProgressFill"
                  style={{ width: `${snapshot.sprint.stats.progressPercent}%` }}
                />
              </div>
            </>
          ) : (
            <p className="acMuted">{t.commandCenter.empty.sprint}</p>
          )}
        </OperatingDaySection>

        <OperatingDaySection phase="currentWork" title={od.sections.risks}>
          {snapshot.risks.length === 0 ? (
            <p className="acMuted">{od.empty.risks}</p>
          ) : (
            <ul className="acOperatingDayList">
              {snapshot.risks.slice(0, 4).map((risk) => (
                <li key={risk.id} className="acOperatingDayListRow">
                  <div>
                    <div className="acOperatingDayListTitle">{risk.title}</div>
                    <div className="acMuted">{risk.description}</div>
                  </div>
                  <span className="acOperatingDayBadge">{controlRoomRiskLevelLabel(t, risk.severity)}</span>
                </li>
              ))}
            </ul>
          )}
        </OperatingDaySection>

        <OperatingDaySection phase="currentWork" title={od.sections.deliveries}>
          {snapshot.deliveries.length === 0 ? (
            <p className="acMuted">{od.empty.deliveries}</p>
          ) : (
            <ul className="acOperatingDayList">
              {snapshot.deliveries.map((item) => (
                <li key={item.id} className="acOperatingDayListRow">
                  <div>
                    <div className="acOperatingDayListTitle">{item.title}</div>
                    <div className="acMono acMuted">{item.assigneeId}</div>
                  </div>
                  <span className="acOperatingDayBadge">{taskStatusLabel(t, item.status)}</span>
                </li>
              ))}
            </ul>
          )}
        </OperatingDaySection>

        <OperatingDaySection phase="meetings" title={od.sections.meetings}>
          {snapshot.meetings.length === 0 ? (
            <p className="acMuted">{od.empty.meetings}</p>
          ) : (
            <ul className="acOperatingDayList">
              {snapshot.meetings.map((meeting) => (
                <li key={meeting.id} className="acOperatingDayListRow">
                  <div>
                    <Link to={meeting.href} className="acOperatingDayListTitle acLink">
                      {meeting.title}
                    </Link>
                    <div className="acMuted">
                      {t.collaborationEngine.status[meeting.status]} · {meeting.participantCount}{' '}
                      {t.collaborationEngine.participants.toLowerCase()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </OperatingDaySection>

        <OperatingDaySection phase="approvals" title={od.sections.approvals}>
          {snapshot.pendingApprovals.length === 0 ? (
            <p className="acMuted">{t.commandCenter.empty.approvals}</p>
          ) : (
            <ul className="acOperatingDayList">
              {snapshot.pendingApprovals.map((approval) => (
                <li key={approval.id} className="acOperatingDayListRow">
                  <Link to={`/ops/approvals/${encodeURIComponent(approval.id)}`} className="acLink">
                    {approval.title}
                  </Link>
                  <span className="acOperatingDayBadge">
                    {approvalPriorityLabel(t, approval.priority)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </OperatingDaySection>

        <OperatingDaySection phase="runtime" title={od.sections.runtime}>
          <div className="acOperatingDayStats">
            <div className="acOperatingDayStat">
              <span className="acOperatingDayStatValue">{snapshot.runtime.total}</span>
              <span className="acOperatingDayStatLabel">{t.commandCenter.runtimeTotal}</span>
            </div>
            <div className="acOperatingDayStat">
              <span className="acOperatingDayStatValue">{snapshot.runtime.waitingApproval}</span>
              <span className="acOperatingDayStatLabel">{t.commandCenter.runtimeWaiting}</span>
            </div>
            <div className="acOperatingDayStat">
              <span className="acOperatingDayStatValue">{snapshot.runtime.completed}</span>
              <span className="acOperatingDayStatLabel">{t.commandCenter.toolCompleted}</span>
            </div>
          </div>
          {snapshot.runtime.recentRuns.length === 0 ? (
            <p className="acMuted">{t.commandCenter.empty.runtime}</p>
          ) : (
            <ul className="acOperatingDayList">
              {snapshot.runtime.recentRuns.slice(0, 4).map((run) => (
                <li key={run.id} className="acOperatingDayListRow">
                  <Link to={`/ops/runtime/runs/${encodeURIComponent(run.id)}`} className="acLink">
                    {run.taskId ?? run.runtimeProfileId}
                  </Link>
                  <span className="acOperatingDayBadge">{runtimeStateLabel(t, run.status)}</span>
                </li>
              ))}
            </ul>
          )}
        </OperatingDaySection>

        <OperatingDaySection phase="reports" title={od.sections.reports}>
          {snapshot.reports.length === 0 ? (
            <p className="acMuted">{t.commandCenter.empty.reports}</p>
          ) : (
            <ul className="acOperatingDayList">
              {snapshot.reports.map((report) => (
                <li key={report.id} className="acOperatingDayListRow">
                  <Link to={`/ops/reports/${encodeURIComponent(report.id)}`} className="acLink">
                    {report.title}
                  </Link>
                  <span className="acOperatingDayBadge">{reportTypeLabel(t, report.type)}</span>
                </li>
              ))}
            </ul>
          )}
        </OperatingDaySection>

        <OperatingDaySection phase="reports" title={od.sections.companyHealth}>
          <div className="acOperatingDayHealthScore">
            <span className="acOperatingDayHealthValue">{snapshot.healthScore}</span>
            <span className="acMuted">{t.commandCenter.healthScoreLabel}</span>
          </div>
          <ul className="acOperatingDayList">
            {snapshot.systemHealth.map((item) => (
              <li key={item.id} className="acOperatingDayListRow">
                <span>{item.label}</span>
                <span className="acOperatingDayBadge">{providerHealthLabel(t, item.status)}</span>
              </li>
            ))}
          </ul>
        </OperatingDaySection>

        <OperatingDaySection phase="endOfDay" title={od.sections.eveningSummary}>
          <div className="acOperatingDaySummaryGrid">
            <SummaryTile label={od.evening.finished} value={snapshot.eveningSummary.finishedCount} />
            <SummaryTile label={od.evening.reportsToday} value={snapshot.eveningSummary.reportsToday} />
            <SummaryTile label={od.evening.tasksActive} value={snapshot.eveningSummary.tasksCompleted} />
            <SummaryTile label={od.evening.approvalsPending} value={snapshot.eveningSummary.approvalsPending} />
            <SummaryTile label={od.evening.runtimeCompleted} value={snapshot.eveningSummary.runtimeCompleted} />
            <SummaryTile
              label={od.evening.avgPhase}
              value={snapshot.eveningSummary.avgPhaseIndex.toFixed(1)}
            />
          </div>
          <p className="acMuted acOperatingDayEveningNote">{od.evening.note}</p>
        </OperatingDaySection>
      </div>
    </div>
  )
}

function OperatingDaySection(props: {
  phase: OperatingDayPhaseId
  title: string
  children: ReactNode
}) {
  return (
    <section className={`acOperatingDaySection acOperatingDaySection${capitalize(props.phase)}`}>
      <h2 className="acOperatingDaySectionTitle">{props.title}</h2>
      <div className="acOperatingDaySectionBody">{props.children}</div>
    </section>
  )
}

function SummaryTile(props: { label: string; value: string | number }) {
  return (
    <div className="acOperatingDaySummaryTile">
      <div className="acOperatingDaySummaryLabel">{props.label}</div>
      <div className="acOperatingDaySummaryValue">{props.value}</div>
    </div>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
