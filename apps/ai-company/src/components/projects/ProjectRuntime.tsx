import { Link } from 'react-router-dom'
import { Panel } from '../../mission-control/components/ui'
import type { Project } from '../../domain/projects'
import { useRuntime } from '../../hooks/useRuntime'
import { useI18n } from '../../i18n'
import { RuntimeStateBadge } from '../runtime/RuntimeStateBadge'

export function ProjectRuntime({ project }: { project: Project }) {
  const { t } = useI18n()
  const { runs } = useRuntime()

  const queue = runs.slice(0, 8)

  return (
    <Panel title={t.projects.runtime.title}>
      <p className="acMuted" style={{ marginBottom: 12 }}>
        {t.projects.runtime.description.replace('{workspace}', project.workspaceId)}
      </p>
      {queue.length === 0 ? (
        <p className="acMuted">{t.projects.runtime.empty}</p>
      ) : (
        <div className="acProjectRuntimeList">
          {queue.map((run) => (
            <Link
              key={run.id}
              to={`/ops/runtime/runs/${encodeURIComponent(run.id)}`}
              className="acProjectRuntimeRow"
            >
              <span className="acMono">{run.id.slice(0, 12)}</span>
              <RuntimeStateBadge state={run.status} />
            </Link>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Link to="/ops/runs" className="mcBtn mcBtnSecondary mcBtnSmall">
          {t.projects.runtime.viewRuns}
        </Link>
        <Link to="/ops/runtime" className="mcBtn mcBtnSecondary mcBtnSmall">
          {t.projects.runtime.settings}
        </Link>
      </div>
    </Panel>
  )
}
