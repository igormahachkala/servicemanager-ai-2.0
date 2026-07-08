import type { MobileRunTaskEmployeeOption } from '../runTask/mobileRunTaskConfig'
import { useI18n } from '../../i18n'

type MobileEmployeePickerProps = {
  employees: MobileRunTaskEmployeeOption[]
  selectedId: string
  onSelect: (employeeId: string) => void
}

export function MobileEmployeePicker({ employees, selectedId, onSelect }: MobileEmployeePickerProps) {
  const { t } = useI18n()

  return (
    <div className="acMobileEmployeePicker" role="radiogroup" aria-label={t.mobile.runTask.employeePickerLabel}>
      {employees.map((employee) => {
        const selected = employee.id === selectedId
        const disabled = !employee.enabled

        return (
          <button
            key={employee.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={disabled}
            disabled={disabled}
            className={
              selected
                ? 'acMobileEmployeePickerItem acMobileEmployeePickerItemSelected'
                : disabled
                  ? 'acMobileEmployeePickerItem acMobileEmployeePickerItemDisabled'
                  : 'acMobileEmployeePickerItem'
            }
            onClick={() => onSelect(employee.id)}
          >
            <span className="acMobileEmployeePickerAvatar" aria-hidden>
              {employee.codename.slice(0, 2).toUpperCase()}
            </span>
            <span className="acMobileEmployeePickerText">
              <span className="acMobileEmployeePickerName">{employee.codename}</span>
              <span className="acMobileEmployeePickerRole">{employee.role}</span>
              {disabled ? (
                <span className="acMobileEmployeePickerHint">{t.mobile.runTask.employeeComingSoon}</span>
              ) : null}
            </span>
            {selected ? <span className="acMobileEmployeePickerCheck" aria-hidden>✓</span> : null}
          </button>
        )
      })}
    </div>
  )
}
