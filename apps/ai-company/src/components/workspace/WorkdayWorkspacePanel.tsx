import { Link } from 'react-router-dom'
import { WorkdayPhaseTracker, WorkdayStateBadge } from '../workday'
import { useWorkday } from '../../hooks/useWorkday'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

export function WorkdayWorkspacePanel(props: { employeeId: string }) {
  const { t } = useI18n()
  const { employeeWorkday, start, advance, finish } = useWorkday(props.employeeId)

  return (
    <Panel title={t.workdayEngine.workspace.title}>
      <div className="acWorkdayWorkspacePanel">
        {!employeeWorkday ? (
          <p className="acMuted">{t.workdayEngine.workspace.noWorkday}</p>
        ) : (
          <>
            <WorkdayStateBadge state={employeeWorkday.state} />
            <WorkdayPhaseTracker currentPhase={employeeWorkday.phase} />
            {employeeWorkday.blockedReason ? (
              <p className="acWorkdayBlockedNote">{employeeWorkday.blockedReason}</p>
            ) : null}
          </>
        )}

        <div className="acWorkdayWorkspaceActions">
          {!employeeWorkday?.startedAt ? (
            <button type="button" className="mcBtn mcBtnPrimary mcBtnSmall" onClick={() => start(props.employeeId)}>
              {t.workdayEngine.actions.startDay}
            </button>
          ) : employeeWorkday.state !== 'finished' ? (
            <>
              <button type="button" className="mcBtn mcBtnSecondary mcBtnSmall" onClick={() => advance(props.employeeId)}>
                {t.workdayEngine.actions.nextPhase}
              </button>
              <button type="button" className="mcBtn mcBtnSecondary mcBtnSmall" onClick={() => finish(props.employeeId)}>
                {t.workdayEngine.actions.finishDay}
              </button>
            </>
          ) : null}
          <Link to="/ops/workday" className="mcBtn mcBtnSecondary mcBtnSmall">
            {t.workdayEngine.workspace.openDashboard}
          </Link>
        </div>
      </div>
    </Panel>
  )
}
