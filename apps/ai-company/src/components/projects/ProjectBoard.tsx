import { Panel } from '../../mission-control/components/ui'
import type { Project } from '../../domain/projects'
import { useI18n } from '../../i18n'

const BOARD_COLUMNS = ['backlog', 'in_progress', 'review', 'done'] as const

export function ProjectBoard({ project }: { project: Project }) {
  const { t } = useI18n()

  const itemsByColumn = (column: (typeof BOARD_COLUMNS)[number]) => {
    if (column === 'backlog') {
      return project.milestones.filter((item) => item.status === 'planned')
    }
    if (column === 'in_progress') {
      return project.milestones.filter((item) => item.status === 'in_progress')
    }
    if (column === 'review') {
      return project.milestones.filter((item) => item.status === 'blocked')
    }
    return project.milestones.filter((item) => item.status === 'done')
  }

  return (
    <Panel title={t.projects.board.title}>
      <p className="acMuted" style={{ marginBottom: 16 }}>
        {t.projects.board.description}
      </p>
      <div className="acProjectBoard">
        {BOARD_COLUMNS.map((column) => (
          <div key={column} className="acProjectBoardColumn">
            <div className="acProjectBoardColumnHead">{t.projects.board.columns[column]}</div>
            <div className="acProjectBoardCards">
              {itemsByColumn(column).length === 0 ? (
                <div className="acProjectBoardEmpty">{t.projects.board.empty}</div>
              ) : (
                itemsByColumn(column).map((item) => (
                  <div key={item.id} className="acProjectBoardCard">
                    <div className="acProjectBoardCardTitle">{item.title}</div>
                    <div className="acMuted" style={{ fontSize: 12 }}>
                      {item.progress}%
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}
