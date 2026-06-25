import { Link } from 'react-router-dom'
import { Panel } from '../../mission-control/components/ui'
import { RunCard } from './RunCard'
import { useRunHistory } from '../../hooks/useRunHistory'
import { useI18n } from '../../i18n'

export function EmployeeRunHistory({ employeeId }: { employeeId: string }) {
  const { t } = useI18n()
  const { filtered } = useRunHistory({ employeeId })

  return (
    <Panel
      title={t.runEngine.employeeRunsTitle}
      right={
        <Link to="/ops/runs" className="mcBtn mcBtnSecondary mcBtnSmall">
          {t.runEngine.openAllRuns}
        </Link>
      }
    >
      <div className="mcProfilePanelBody">
        <p className="mcMuted">{t.runEngine.employeeRunsDescription}</p>
        {filtered.length === 0 ? (
          <div className="mcRunEmptyInline">
            <p className="mcMuted">{t.runEngine.emptyEmployeeRuns}</p>
          </div>
        ) : (
          <div className="mcRunCardGrid">
            {filtered.slice(0, 4).map((run) => (
              <RunCard key={run.id} run={run} />
            ))}
          </div>
        )}
      </div>
    </Panel>
  )
}
