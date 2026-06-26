import type { SprintSnapshot } from '../../domain/sprint/sprintStorage'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

type Props = {
  snapshot: SprintSnapshot
}

export function SprintReview({ snapshot }: Props) {
  const { t } = useI18n()
  const { sprint } = snapshot

  return (
    <Panel title={t.sprintEngine.sections.review}>
      <div className="mcProfilePanelBody mcSprintReview">
        <div className="mcSprintDoSection">
          <h4 className="mcSprintSubhead">{t.sprintEngine.definitionOfReady}</h4>
          <ul className="mcSprintDoList">
            {sprint.definitionOfReady.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="mcSprintDoSection">
          <h4 className="mcSprintSubhead">{t.sprintEngine.definitionOfDone}</h4>
          <ul className="mcSprintDoList">
            {sprint.definitionOfDone.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        {sprint.reviewNotes.length > 0 ? (
          <div className="mcSprintDoSection">
            <h4 className="mcSprintSubhead">{t.sprintEngine.reviewNotes}</h4>
            <ul className="mcSprintDoList">
              {sprint.reviewNotes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Panel>
  )
}
