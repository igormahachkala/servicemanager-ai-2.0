import type { ToolExecution } from '../../domain/toolExecution'
import { useI18n } from '../../i18n'
import { ToolRequestCard } from './ToolRequestCard'

export function ToolExecutionLog(props: {
  executions: ToolExecution[]
  selectedId: string | null
  onSelect: (executionId: string) => void
}) {
  const { t } = useI18n()

  if (props.executions.length === 0) {
    return <div className="mcMuted">{t.toolExecutionEngine.log.empty}</div>
  }

  return (
    <div className="acToolExecutionLog">
      {props.executions.map((execution) => (
        <div className="acToolExecutionLogRow" key={execution.id}>
          <ToolRequestCard
            execution={execution}
            compact
            selected={props.selectedId === execution.id}
            onSelect={props.onSelect}
          />
        </div>
      ))}
    </div>
  )
}
