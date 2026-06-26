import type { HandoffContext } from '../../domain/handoff'
import { useI18n } from '../../i18n'

export function HandoffContextPanel({ context }: { context: HandoffContext }) {
  const { t } = useI18n()

  return (
    <div className="acHandoffContextPanel">
      <div className="acHandoffContextRow">
        <span>{t.handoffEngine.fields.project}</span>
        <span>{context.projectName}</span>
      </div>
      <div className="acHandoffContextRow">
        <span>{t.handoffEngine.fields.workspace}</span>
        <span>{context.workspaceName}</span>
      </div>
      <div className="acHandoffContextRow">
        <span>{t.handoffEngine.fields.preparedBy}</span>
        <span className="mcMono">{context.employeeCodename}</span>
      </div>
      {context.taskTitle ? (
        <div className="acHandoffContextRow">
          <span>{t.handoffEngine.fields.task}</span>
          <span>{context.taskTitle}</span>
        </div>
      ) : null}
      <p className="acHandoffContextSummary">{context.summary}</p>
      {context.relatedPaths.length > 0 ? (
        <div className="acHandoffPathList">
          <span className="mcFieldLabel">{t.handoffEngine.fields.paths}</span>
          <ul>
            {context.relatedPaths.map((path) => (
              <li key={path} className="mcMono">
                {path}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {context.notes ? <p className="mcMuted">{context.notes}</p> : null}
    </div>
  )
}
