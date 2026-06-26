import { Link } from 'react-router-dom'
import { HandoffCard } from '../handoff'
import type { Project } from '../../domain/projects/project'
import { useHandoffs } from '../../hooks/useHandoffs'
import { useI18n } from '../../i18n'
import { Panel } from '../../mission-control/components/ui'

export function ProjectHandoffs({ project }: { project: Project }) {
  const { t } = useI18n()
  const { filtered } = useHandoffs({ projectId: project.id })

  return (
    <Panel
      title={t.handoffEngine.projectPanelTitle}
      right={
        <Link to={`/ops/handoffs?project=${encodeURIComponent(project.id)}`} className="mcBtn mcBtnSecondary mcBtnSm">
          {t.handoffEngine.openAll}
        </Link>
      }
    >
      <div className="mcProfilePanelBody">
        <p className="mcMuted" style={{ marginBottom: 12 }}>
          {t.handoffEngine.projectPanelDescription}
        </p>
        {filtered.length === 0 ? (
          <p className="mcMuted">{t.handoffEngine.projectEmpty}</p>
        ) : (
          <div className="acHandoffList">
            {filtered.slice(0, 6).map((handoff) => (
              <HandoffCard key={handoff.id} handoff={handoff} compact />
            ))}
          </div>
        )}
      </div>
    </Panel>
  )
}
