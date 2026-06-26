import { Link } from 'react-router-dom'
import { RuntimeRunCard } from '../runtime/RuntimeRunCard'
import type { EmployeeWorkspaceSnapshot } from '../../hooks/useEmployeeWorkspace'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

export function CurrentRun({ snapshot }: { snapshot: EmployeeWorkspaceSnapshot }) {
  const { t } = useI18n()

  return (
    <Panel
      title={t.employeeWorkspace.sections.currentRun}
      right={
        <Link to={`/ops/employees/${snapshot.employee.id}/runtime`} className="mcBtn mcBtnSecondary mcBtnSm">
          {t.employeeWorkspace.openRuntime}
        </Link>
      }
    >
      <div className="mcProfilePanelBody acStack">
        {snapshot.currentRun ? (
          <Link to={`/ops/runtime/runs/${snapshot.currentRun.id}`} className="acWorkspaceRunLink">
            <RuntimeRunCard run={snapshot.currentRun} />
          </Link>
        ) : (
          <p className="mcMuted">{t.employeeWorkspace.empty.currentRun}</p>
        )}

        {snapshot.recentRuns.length > 0 ? (
          <div className="acWorkspaceSubsection">
            <span className="mcFieldLabel">{t.employeeWorkspace.sections.recentRuns}</span>
            <div className="acWorkspaceRunList">
              {snapshot.recentRuns
                .filter((run) => run.id !== snapshot.currentRun?.id)
                .slice(0, 3)
                .map((run) => (
                  <Link key={run.id} to={`/ops/runtime/runs/${run.id}`} className="acWorkspaceRunLink">
                    <RuntimeRunCard run={run} />
                  </Link>
                ))}
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  )
}
