import type { SprintSnapshot } from '../../domain/sprint/sprintStorage'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

type Props = {
  snapshot: SprintSnapshot
}

export function SprintCapacity({ snapshot }: Props) {
  const { t } = useI18n()
  const { sprint, stats } = snapshot

  return (
    <Panel title={t.sprintEngine.sections.capacity}>
      <div className="mcProfilePanelBody">
        <div className="mcSprintCapacitySummary">
          <div>
            <span className="mcSprintCapacityLabel">{t.sprintEngine.capacityTotal}</span>
            <span className="mcSprintCapacityValue">{stats.capacityTotal} SP</span>
          </div>
          <div>
            <span className="mcSprintCapacityLabel">{t.sprintEngine.commitment}</span>
            <span className="mcSprintCapacityValue">{stats.commitmentPoints} SP</span>
          </div>
          <div>
            <span className="mcSprintCapacityLabel">{t.sprintEngine.capacityRemaining}</span>
            <span className="mcSprintCapacityValue">{stats.capacityRemaining} SP</span>
          </div>
        </div>
        <ul className="mcSprintCapacityList">
          {sprint.capacity.members.map((member) => (
            <li key={member.employeeId} className="mcSprintCapacityRow">
              <span className="mcSprintCapacityName">{member.codename}</span>
              <span className="mcMuted">{member.role}</span>
              <span className="mcMono">{member.storyPoints} SP</span>
              <span className="mcMuted">{member.hours}h</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  )
}
