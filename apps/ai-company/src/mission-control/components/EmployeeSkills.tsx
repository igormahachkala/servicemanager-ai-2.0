import { Panel } from './ui'
import { optionLabel } from '../data/customEmployees'
import type { CustomEmployee } from '../data/customEmployees'
import { useI18n } from '../../i18n'

export function EmployeeSkills({ employee }: { employee: CustomEmployee }) {
  const { t } = useI18n()

  if (employee.skills.length === 0) {
    return (
      <Panel title={t.employeeProfile.sections.skills}>
        <div className="mcProfilePanelBody">
          <div className="mcProfileEmpty mcProfileEmptyInline">
            <div className="mcProfileEmptyTitle">{t.employeeProfile.noSkills}</div>
            <p className="mcProfileEmptyDesc">{t.employeeProfile.noSkillsHint}</p>
          </div>
        </div>
      </Panel>
    )
  }

  return (
    <Panel title={t.employeeProfile.sections.skills}>
      <div className="mcProfilePanelBody">
        <div className="mcProfileSkillGrid">
          {employee.skills.map((skill) => (
            <div key={skill} className="mcProfileSkillCard">
              <span className="mcProfileSkillName">
                {optionLabel(t.employeeBuilder.options.skills, skill)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}
