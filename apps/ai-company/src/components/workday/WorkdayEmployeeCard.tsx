import { Link } from 'react-router-dom'
import type { WorkdayDashboardEntry } from '../../domain/workday'
import { useI18n } from '../../i18n'
import { WorkdayPhaseTracker } from './WorkdayPhaseTracker'
import { WorkdayStateBadge } from './WorkdayStateBadge'

export function WorkdayEmployeeCard(props: {
  entry: WorkdayDashboardEntry
  onStart?: (employeeId: string) => void
  onAdvance?: (employeeId: string) => void
  onFinish?: (employeeId: string) => void
}) {
  const { t } = useI18n()
  const { workday, employeeCodename } = props.entry

  return (
    <article className="acWorkdayEmployeeCard">
      <div className="acWorkdayEmployeeCardHead">
        <div>
          <Link to={`/ops/employees/${workday.employeeId}/workspace`} className="acWorkdayEmployeeName">
            {employeeCodename}
          </Link>
          <div className="acMuted acWorkdayEmployeeMeta">{workday.employeeId}</div>
        </div>
        <WorkdayStateBadge state={workday.state} compact />
      </div>

      <WorkdayPhaseTracker currentPhase={workday.phase} />

      {workday.blockedReason ? (
        <p className="acWorkdayBlockedNote">{workday.blockedReason}</p>
      ) : null}

      {workday.agendaItems.length > 0 ? (
        <ul className="acWorkdayAgendaPreview">
          {workday.agendaItems.slice(0, 3).map((item) => (
            <li key={item.id} className={item.completed ? 'acWorkdayAgendaDone' : ''}>
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="acWorkdayCardActions">
        {!workday.startedAt ? (
          <button type="button" className="mcBtn mcBtnPrimary mcBtnSmall" onClick={() => props.onStart?.(workday.employeeId)}>
            {t.workdayEngine.actions.startDay}
          </button>
        ) : workday.state !== 'finished' ? (
          <>
            <button type="button" className="mcBtn mcBtnSecondary mcBtnSmall" onClick={() => props.onAdvance?.(workday.employeeId)}>
              {t.workdayEngine.actions.nextPhase}
            </button>
            <button type="button" className="mcBtn mcBtnSecondary mcBtnSmall" onClick={() => props.onFinish?.(workday.employeeId)}>
              {t.workdayEngine.actions.finishDay}
            </button>
          </>
        ) : null}
        <Link to={`/ops/employees/${workday.employeeId}/workspace`} className="mcBtn mcBtnSecondary mcBtnSmall">
          {t.workdayEngine.actions.openWorkspace}
        </Link>
      </div>
    </article>
  )
}
