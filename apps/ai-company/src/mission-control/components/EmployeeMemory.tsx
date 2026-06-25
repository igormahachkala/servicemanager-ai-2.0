import { Panel } from './ui'
import { ProfileEmptyBlock } from './ProfileEmptyBlock'
import { optionLabel } from '../data/customEmployees'
import type { CustomEmployee } from '../data/customEmployees'
import { useI18n } from '../../i18n'

export function EmployeeMemory({ employee }: { employee: CustomEmployee }) {
  const { t } = useI18n()

  return (
    <div className="mcStack">
      <Panel title={t.employeeProfile.sections.memory}>
        <div className="mcProfilePanelBody">
          {employee.memoryScope.length === 0 ? (
            <div className="mcProfileEmpty mcProfileEmptyInline">
              <div className="mcProfileEmptyTitle">{t.employeeProfile.noMemoryScope}</div>
              <p className="mcProfileEmptyDesc">{t.employeeProfile.noMemoryScopeHint}</p>
            </div>
          ) : (
            <div className="mcTagRow">
              {employee.memoryScope.map((scope) => (
                <span key={scope} className="mcTag">
                  {optionLabel(t.employeeBuilder.options.memoryScope, scope)}
                </span>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <Panel title={t.employeeProfile.future.memoryTimeline}>
        <div className="mcProfilePanelBody">
          <ProfileEmptyBlock
            badge={t.employeeProfile.futureBadge}
            title={t.employeeProfile.future.memoryTimeline}
            description={t.employeeProfile.future.memoryTimelineDesc}
          />
        </div>
      </Panel>
    </div>
  )
}
