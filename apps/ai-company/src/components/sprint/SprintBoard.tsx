import type { SprintBoardColumn } from '../../domain/sprint/sprint'
import type { SprintSnapshot } from '../../domain/sprint/sprintStorage'
import { BOARD_COLUMNS } from '../../domain/sprint/sprint'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

type Props = {
  snapshot: SprintSnapshot
}

export function SprintBoard({ snapshot }: Props) {
  const { t } = useI18n()

  return (
    <Panel title={t.sprintEngine.sections.board}>
      <div className="mcProfilePanelBody mcSprintBoard">
        {BOARD_COLUMNS.map((column) => (
          <SprintColumn
            key={column}
            column={column}
            title={t.sprintEngine.columns[column]}
            items={snapshot.byColumn[column]}
            storyPointsSuffix={t.sprintEngine.storyPointsShort}
          />
        ))}
      </div>
    </Panel>
  )
}

function SprintColumn({
  column,
  title,
  items,
  storyPointsSuffix,
}: {
  column: SprintBoardColumn
  title: string
  items: SprintSnapshot['tasks']
  storyPointsSuffix: string
}) {
  return (
    <div className={`mcSprintColumn mcSprintColumn${column}`}>
      <div className="mcSprintColumnHead">
        <span>{title}</span>
        <span className="mcSprintColumnCount">{items.length}</span>
      </div>
      <ul className="mcSprintColumnList">
        {items.length === 0 ? (
          <li className="mcSprintColumnEmpty">—</li>
        ) : (
          items.map(({ entry, task, assigneeCodename }) => (
            <li key={task.id} className="mcSprintCard">
              <div className="mcSprintCardTitle">{task.title}</div>
              <div className="mcSprintCardMeta">
                <span>{assigneeCodename}</span>
                <span className="mcMono">{entry.storyPoints}{storyPointsSuffix}</span>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
