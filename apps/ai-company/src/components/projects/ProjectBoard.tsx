import { Panel } from '../../mission-control/components/ui'
import type { Project } from '../../domain/projects'
import { useProjectTasks } from '../../hooks/useProjectTasks'
import { useI18n } from '../../i18n'

const BOARD_COLUMNS = ['backlog', 'in_progress', 'review', 'done'] as const

const STATUS_MAP: Record<(typeof BOARD_COLUMNS)[number], string[]> = {
  backlog: ['backlog'],
  in_progress: ['in_progress'],
  review: ['review', 'blocked'],
  done: ['done'],
}

export function ProjectBoard({ project }: { project: Project }) {
  const { t } = useI18n()
  const { tasks } = useProjectTasks(project.id)

  const itemsByColumn = (column: (typeof BOARD_COLUMNS)[number]) =>
    tasks.filter((item) => STATUS_MAP[column].includes(item.status))

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
                      {t.projects.taskPriority[item.priority]} · {item.id}
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
