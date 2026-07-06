import { Link } from 'react-router-dom'
import { useMaxEmployeeWorkspace } from '../hooks/useMaxEmployeeWorkspace'
import { MAX_WORKER_EMPLOYEE_ID } from '../domain/maxWorkerLoop'
import { Panel } from '../mission-control/components/ui'
import { useI18n } from '../i18n'

export function MaxEmployeeWorkspaceSummary() {
  const { t } = useI18n()
  const { view } = useMaxEmployeeWorkspace()
  const labels = t.maxWorkspace.summary

  return (
    <Panel title={labels.title}>
      <div className="acMaxWorkspaceSummary">
        {view.hasWork ? (
          <dl className="acMaxWorkspaceSummaryMeta">
            <div>
              <dt>{labels.task}</dt>
              <dd>{view.task?.title ?? '—'}</dd>
            </div>
            <div>
              <dt>{labels.status}</dt>
              <dd>{view.workStatus?.statusLabel ?? '—'}</dd>
            </div>
            <div>
              <dt>{labels.phase}</dt>
              <dd>{view.workerLoopPhase?.domainPhaseLabel ?? '—'}</dd>
            </div>
            <div>
              <dt>{labels.cursor}</dt>
              <dd>{view.cursorAutomation?.statusLabel ?? labels.cursorIdle}</dd>
            </div>
          </dl>
        ) : (
          <p className="mcMuted">{labels.empty}</p>
        )}
        <Link
          to={`/ops/employees/${MAX_WORKER_EMPLOYEE_ID}/workspace`}
          className="mcBtn mcBtnPrimary mcBtnSm"
        >
          {labels.openWorkspace}
        </Link>
      </div>
    </Panel>
  )
}
