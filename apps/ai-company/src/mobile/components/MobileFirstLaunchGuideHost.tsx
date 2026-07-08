import { useCallback, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { mobileGuideRouteMatches } from '../guide/mobileFirstLaunchGuideConfig'
import { MOBILE_PATHS } from '../navigation/mobileHrefResolver'
import {
  isMobileFirstLaunchGuideCompleted,
  useMobileFirstLaunchGuide,
} from '../hooks/useMobileFirstLaunchGuide'
import { useMobileBottomSheet } from '../hooks/useMobileBottomSheet'
import { MobileFirstLaunchGuidePanel } from './MobileFirstLaunchGuidePanel'
import { MobileFirstLaunchGuideSpotlight } from './MobileFirstLaunchGuideSpotlight'

export function MobileFirstLaunchGuideHost() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const { openSheet, closeSheet } = useMobileBottomSheet()
  const guide = useMobileFirstLaunchGuide()
  const autoStartedRef = useRef(false)

  useEffect(() => {
    if (autoStartedRef.current || isMobileFirstLaunchGuideCompleted()) return
    autoStartedRef.current = true
    const timer = window.setTimeout(() => guide.startGuide(), 900)
    return () => window.clearTimeout(timer)
  }, [guide.startGuide])

  const openMax = useCallback(() => {
    guide.nextStep()
    navigate(MOBILE_PATHS.max)
  }, [guide, navigate])

  const assignFirstTask = useCallback(() => {
    guide.completeGuide()
    closeSheet()
    navigate(MOBILE_PATHS.tasksNewMax)
  }, [closeSheet, guide, navigate])

  const closeGuide = useCallback(() => {
    guide.completeGuide()
    closeSheet()
  }, [closeSheet, guide])

  const renderPanel = useCallback(
    () => (
      <MobileFirstLaunchGuidePanel
        stepId={guide.step.id}
        stepIndex={guide.stepIndex}
        stepCount={guide.stepCount}
        onBack={guide.prevStep}
        onNext={guide.nextStep}
        onSkip={() => {
          guide.skipGuide()
          closeSheet()
        }}
        onOpenMax={openMax}
        onAssignFirstTask={assignFirstTask}
        onCloseGuide={closeGuide}
      />
    ),
    [
      assignFirstTask,
      closeGuide,
      closeSheet,
      guide.completeGuide,
      guide.nextStep,
      guide.prevStep,
      guide.skipGuide,
      guide.step.id,
      guide.stepCount,
      guide.stepIndex,
      openMax,
    ],
  )

  useEffect(() => {
    if (!guide.isActive) {
      closeSheet()
      return
    }

    const { step } = guide
    if (!mobileGuideRouteMatches(pathname, search, step.route)) {
      navigate(step.route)
      return
    }

    const timer = window.setTimeout(() => {
      openSheet(renderPanel(), {
        title: t.mobile.firstLaunchGuide.steps[step.id].title,
        ariaLabel: t.mobile.firstLaunchGuide.spotlightAria,
        dismissible: false,
        variant: 'guide',
      })
    }, 180)

    return () => window.clearTimeout(timer)
  }, [
    closeSheet,
    guide.isActive,
    guide.step,
    guide.stepIndex,
    navigate,
    openSheet,
    pathname,
    renderPanel,
    search,
    t.mobile.firstLaunchGuide,
  ])

  return (
    <MobileFirstLaunchGuideSpotlight
      active={guide.isActive}
      targetIds={guide.step.targets}
      ariaLabel={t.mobile.firstLaunchGuide.spotlightAria}
    />
  )
}
