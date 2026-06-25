import { Panel } from './ui'
import { ProfileEmptyBlock } from './ProfileEmptyBlock'
import { useI18n } from '../../i18n'

export function EmployeeRelationships() {
  const { t } = useI18n()

  return (
    <Panel title={t.employeeProfile.sections.relationships}>
      <div className="mcProfilePanelBody">
        <ProfileEmptyBlock
          badge={t.employeeProfile.futureBadge}
          title={t.employeeProfile.future.relationships}
          description={t.employeeProfile.future.relationshipsDesc}
        />
      </div>
    </Panel>
  )
}
