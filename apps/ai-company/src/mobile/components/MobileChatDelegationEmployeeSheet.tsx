import type { DelegationAssignableEmployee } from '../chat/mobileChatDelegation'
import { useI18n } from '../../i18n'

type Props = {
  employees: DelegationAssignableEmployee[]
  selectedEmployeeId: string
  onSelect: (employeeId: string) => void
  onClose: () => void
}

export function MobileChatDelegationEmployeeSheet({
  employees,
  selectedEmployeeId,
  onSelect,
  onClose,
}: Props) {
  const { t } = useI18n()
  const copy = t.mobile.maxChat.delegation.assigneeSheet

  return (
    <div className="acMobileChatDelegationSheet">
      <p className="acMobileChatDelegationSheetIntro">{copy.intro}</p>
      <ul className="acMobileChatDelegationEmployeeList">
        {employees.map((employee) => {
          const selected = employee.employeeId === selectedEmployeeId
          return (
            <li key={employee.employeeId}>
              <button
                type="button"
                className={`acMobileChatDelegationEmployeeBtn${
                  selected ? ' acMobileChatDelegationEmployeeBtnSelected' : ''
                }`}
                disabled={!employee.enabled}
                onClick={() => {
                  if (!employee.enabled) return
                  onSelect(employee.employeeId)
                }}
              >
                <span className="acMobileChatDelegationEmployeeName">{employee.displayName}</span>
                <span className="acMobileChatDelegationEmployeeTitle">{employee.title}</span>
                {!employee.enabled && employee.disabledReason ? (
                  <span className="acMobileChatDelegationEmployeeDisabled">{employee.disabledReason}</span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
      <button type="button" className="acMobileSecondaryBtn acMobileChatDelegationSheetClose" onClick={onClose}>
        {copy.close}
      </button>
    </div>
  )
}
