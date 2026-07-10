import { useCallback } from 'react'
import { listDelegationAssignableEmployees } from '../chat/mobileChatDelegation'
import { MobileChatDelegationEmployeeSheet } from '../components/MobileChatDelegationEmployeeSheet'
import { useI18n } from '../../i18n'
import { useMobileBottomSheet } from './useMobileBottomSheet'

export function useMobileChatDelegationEmployeeSheet() {
  const { t } = useI18n()
  const copy = t.mobile.maxChat.delegation.assigneeSheet
  const { openSheet, closeSheet } = useMobileBottomSheet()

  const openAssigneePicker = useCallback(
    (input: { selectedEmployeeId: string; onSelect: (employeeId: string) => void }) => {
      const employees = listDelegationAssignableEmployees(copy.unavailableReason)
      openSheet(
        <MobileChatDelegationEmployeeSheet
          employees={employees}
          selectedEmployeeId={input.selectedEmployeeId}
          onSelect={(employeeId) => {
            input.onSelect(employeeId)
            closeSheet()
          }}
          onClose={closeSheet}
        />,
        { title: copy.title },
      )
    },
    [closeSheet, copy.title, copy.unavailableReason, openSheet],
  )

  return { openAssigneePicker }
}
