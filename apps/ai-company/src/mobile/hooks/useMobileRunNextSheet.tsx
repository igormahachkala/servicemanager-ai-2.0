import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { WorkItem } from '../../domain/employeeWorkQueue'
import { useI18n } from '../../i18n'
import { MobileRunNextSheetFlow } from '../components/MobileRunNextConfirmationSheet'
import { mobileRunNextPreviewFromWorkItem } from '../goldenPath/mobileRunNextPreview'
import { setMobileGoldenPathActive } from '../goldenPath/mobileGoldenPathStorage'
import { MOBILE_PATHS, mobileRuntimeLoopHref } from '../navigation/mobileHrefResolver'
import { useMobileBottomSheet } from './useMobileBottomSheet'
import { useMobileEmployeeProfile, type MobileRunNextPreview } from './useMobileEmployeeProfile'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'

type OpenRunNextOptions = {
  preview?: MobileRunNextPreview
  workItem?: WorkItem
  goldenPath?: boolean
}

export function useMobileRunNextSheet(employeeId: string = MAX_WORKER_EMPLOYEE_ID) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { openSheet, closeSheet } = useMobileBottomSheet()
  const canonical = resolveCanonicalEmployeeId(employeeId)
  const employee = useMobileEmployeeProfile(canonical)

  const openRunNextFlow = useCallback(
    (options: OpenRunNextOptions = {}) => {
      const goldenPath = options.goldenPath ?? true
      const preview =
        options.preview ??
        (options.workItem
          ? mobileRunNextPreviewFromWorkItem(
              options.workItem,
              employee.snapshot.employee?.codename ?? canonical,
              employee.snapshot.modelLabel,
            )
          : employee.getRunNextPreview())

      if (!preview) return false

      const handleGoldenPathStart = () => {
        setMobileGoldenPathActive(true)
        closeSheet()
        navigate(MOBILE_PATHS.runtime, { state: { goldenPath: true } })
        void employee.runNext().then((result) => {
          if (result.loopId) {
            navigate(mobileRuntimeLoopHref(result.loopId), {
              state: { goldenPath: true },
              replace: true,
            })
          }
        })
      }

      openSheet(
        <MobileRunNextSheetFlow
          preview={preview}
          runNext={employee.runNext}
          goldenPath={goldenPath}
          onGoldenPathStart={goldenPath ? handleGoldenPathStart : undefined}
          onClose={closeSheet}
        />,
        {
          title: t.mobile.maxControl.runNextConfirm.sheetTitle,
          ariaLabel: t.mobile.maxControl.runNextConfirm.sheetTitle,
        },
      )
      return true
    },
    [canonical, closeSheet, employee, navigate, openSheet, t.mobile.maxControl.runNextConfirm.sheetTitle],
  )

  return {
    openRunNextFlow,
    canRunNext: useCallback(() => employee.getRunNextPreview() != null, [employee]),
  }
}
