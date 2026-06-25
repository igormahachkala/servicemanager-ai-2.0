import { Link } from 'react-router-dom'
import { Badge, Card } from '../layout'
import type { Project } from '../../domain/projects'
import { useKnowledge } from '../../hooks/useKnowledge'
import { useI18n } from '../../i18n'

export function ProjectKnowledge({ project }: { project: Project }) {
  const { t } = useI18n()
  const { getForWorkspace } = useKnowledge()
  const items = getForWorkspace(project.workspaceId)

  return (
    <Card title={t.projects.knowledge.title}>
      <p className="acMuted" style={{ marginBottom: 16 }}>
        {t.projects.knowledge.description}
      </p>
      {items.length === 0 ? (
        <p className="acMuted">{t.projects.knowledge.empty}</p>
      ) : (
        items.map((item) => (
          <div key={item.id} className="acListRow">
            <Link to={`/ops/knowledge/${encodeURIComponent(item.id)}`} className="acLink">
              {item.title}
            </Link>
            <Badge variant="default">{item.type}</Badge>
            <span className="acMuted">{item.summary}</span>
          </div>
        ))
      )}
      <Link
        to={`/ops/workspaces/${encodeURIComponent(project.workspaceId)}`}
        className="mcBtn mcBtnSecondary mcBtnSmall"
        style={{ marginTop: 12 }}
      >
        {t.projects.knowledge.openWorkspace}
      </Link>
    </Card>
  )
}
