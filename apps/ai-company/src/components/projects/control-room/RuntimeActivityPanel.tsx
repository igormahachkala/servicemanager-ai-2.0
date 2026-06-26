import { Link } from 'react-router-dom'
import type { AiPhotoLabControlRoomSnapshot } from '../../../domain/projects/aiPhotoLabControlRoom'
import { Panel } from '../../../mission-control/components/ui'
import { useI18n } from '../../../i18n'

type Props = {
  snapshot: AiPhotoLabControlRoomSnapshot
}

export function RuntimeActivityPanel({ snapshot }: Props) {
  const { t } = useI18n()

  return (
    <Panel
      title={t.photoLabControlRoom.sections.runtimeActivity}
      right={
        <Link to="/ops/runtime" className="mcLink">
          {t.photoLabControlRoom.openRuntime}
        </Link>
      }
    >
      <div className="mcProfilePanelBody">
        {snapshot.runtimeRuns.length === 0 ? (
          <div className="mcControlRoomEmpty">{t.photoLabControlRoom.empty.runtime}</div>
        ) : (
          <ul className="mcControlRoomRuntimeList">
            {snapshot.runtimeRuns.map((run) => (
              <li key={run.id}>
                <Link to={`/ops/runtime/runs/${encodeURIComponent(run.id)}`} className="mcControlRoomRuntimeTitle">
                  {run.taskId ?? run.id}
                </Link>
                <span className="mcControlRoomBadge">{run.status}</span>
                <span className="mcMono mcMuted">{run.employeeId}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  )
}
