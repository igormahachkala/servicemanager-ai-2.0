import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { WorkItem } from '../../domain/employeeWorkQueue'
import { useI18n } from '../../i18n'
import { MobileRunNextSheetFlow } from '../components/MobileRunNextConfirmationSheet'
import { mobileRunNextPreviewFromWorkItem } from '../goldenPath/mobileRunNextPreview'
import { setMobileGoldenPathActive } from '../goldenPath/mobileGoldenPathStorage'
import { MOBILE_PATHS, mobileRuntimeLoopHref } from '../navigation/mobileHrefResolver'
import { useMobileBottomSheet } from './useMobileBottomSheet'
import { useMobileEmployeeMax, type MobileRunNextPreview } from './useMobileEmployeeMax'

type OpenRunNextOptions = {
  preview?: MobileRunNextPreview
  workItem?: WorkItem
  goldenPath?: boolean
}

export function useMobileRunNextSheet() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { openSheet, closeSheet } = useMobileBottomSheet()
  const max = useMobileEmployeeMax()

  const openRunNextFlow = useCallback(
    (options: OpenRunNextOptions = {}) => {
      const goldenPath = options.goldenPath ?? true
      const preview =
        options.preview ??
        (options.workItem
          ? mobileRunNextPreviewFromWorkItem(
              options.workItem,
              max.snapshot.employee?.codename ?? 'MAX',
              max.snapshot.modelLabel,
            )
          : max.getRunNextPreview())

      if (!preview) return false

      const handleGoldenPathStart = () => {
        setMobileGoldenPathActive(true)
        closeSheet()
        navigate(MOBILE_PATHS.runtime, { state: { goldenPath: true } })
        void max.runNext().then((result) => {
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
          runNext={max.runNext}
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
    [closeSheet, max, navigate, openSheet, t.mobile.maxControl.runNextConfirm.sheetTitle],
  )

  return {
    openRunNextFlow,
    canRunNext: useCallback(() => max.getRunNextPreview() != null, [max]),
  }
}
