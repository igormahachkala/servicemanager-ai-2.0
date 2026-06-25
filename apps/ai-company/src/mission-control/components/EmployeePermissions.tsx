import { Panel } from './ui'
import { PERMISSION_CATEGORIES, type CustomEmployee } from '../data/customEmployees'
import { useI18n } from '../../i18n'

export function EmployeePermissions({ employee }: { employee: CustomEmployee }) {
  const { t } = useI18n()

  return (
    <div className="mcStack">
      <Panel title={t.employeeProfile.sections.permissions}>
        <div className="mcProfilePanelBody mcPermList">
          {PERMISSION_CATEGORIES.map((category) => {
            if (category.key === 'productionDeploy') {
              return (
                <div key={category.key} className="mcPermRow">
                  <span className="mcPermLabel">
                    {t.employeeBuilder.options.permissions[category.key]}
                  </span>
                  <span className="mcMono">
                    {employee.permissions.productionDeploy
                      ? t.employeeBuilder.permissions.enabled
                      : t.common.empty}
                  </span>
                </div>
              )
            }

            const perm = employee.permissions[category.key]
            return (
              <div key={category.key} className="mcPermRow">
                <span className="mcPermLabel">
                  {t.employeeBuilder.options.permissions[category.key]}
                </span>
                <div className="mcPermToggles">
                  <span className="mcProfilePermChip">
                    {t.employeeBuilder.permissions.read}:{' '}
                    {perm.read ? t.employeeProfile.yes : t.employeeProfile.no}
                  </span>
                  <span className="mcProfilePermChip">
                    {t.employeeBuilder.permissions.write}:{' '}
                    {perm.write ? t.employeeProfile.yes : t.employeeProfile.no}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}
