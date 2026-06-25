import { Panel } from './ui'
import { ProfileEmptyBlock } from './ProfileEmptyBlock'
import { useI18n } from '../../i18n'

export function EmployeeAssignments() {
  const { t } = useI18n()

  return (
    <Panel title={t.employeeProfile.sections.assignments}>
      <div className="mcProfilePanelBody">
        <ProfileEmptyBlock
          badge={t.employeeProfile.futureBadge}
          title={t.employeeProfile.future.workspaceAssignments}
          description={t.employeeProfile.future.workspaceAssignmentsDesc}
        />
      </div>
    </Panel>
  )
}
