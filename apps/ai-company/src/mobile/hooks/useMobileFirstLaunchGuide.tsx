import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  MOBILE_FIRST_LAUNCH_GUIDE_STEPS,
  type MobileFirstLaunchGuideStep,
} from '../guide/mobileFirstLaunchGuideConfig'
import {
  isMobileFirstLaunchGuideCompleted,
  markMobileFirstLaunchGuideCompleted,
} from '../guide/mobileFirstLaunchGuideStorage'

type MobileFirstLaunchGuideContextValue = {
  isActive: boolean
  stepIndex: number
  step: MobileFirstLaunchGuideStep
  stepCount: number
  startGuide: () => void
  nextStep: () => void
  prevStep: () => void
  skipGuide: () => void
  completeGuide: () => void
  goToStep: (index: number) => void
}

const MobileFirstLaunchGuideContext = createContext<MobileFirstLaunchGuideContextValue | null>(
  null,
)

export function useMobileFirstLaunchGuide(): MobileFirstLaunchGuideContextValue {
  const ctx = useContext(MobileFirstLaunchGuideContext)
  if (!ctx) {
    throw new Error('useMobileFirstLaunchGuide must be used within MobileFirstLaunchGuideProvider')
  }
  return ctx
}

export function MobileFirstLaunchGuideProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  const step = MOBILE_FIRST_LAUNCH_GUIDE_STEPS[stepIndex] ?? MOBILE_FIRST_LAUNCH_GUIDE_STEPS[0]

  const completeGuide = useCallback(() => {
    markMobileFirstLaunchGuideCompleted()
    setIsActive(false)
    setStepIndex(0)
  }, [])

  const startGuide = useCallback(() => {
    setStepIndex(0)
    setIsActive(true)
  }, [])

  const nextStep = useCallback(() => {
    setStepIndex((current) => {
      if (current >= MOBILE_FIRST_LAUNCH_GUIDE_STEPS.length - 1) {
        markMobileFirstLaunchGuideCompleted()
        setIsActive(false)
        return 0
      }
      return current + 1
    })
  }, [])

  const prevStep = useCallback(() => {
    setStepIndex((current) => Math.max(0, current - 1))
  }, [])

  const skipGuide = useCallback(() => {
    completeGuide()
  }, [completeGuide])

  const goToStep = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, MOBILE_FIRST_LAUNCH_GUIDE_STEPS.length - 1))
    setStepIndex(clamped)
  }, [])

  const value = useMemo(
    () => ({
      isActive,
      stepIndex,
      step,
      stepCount: MOBILE_FIRST_LAUNCH_GUIDE_STEPS.length,
      startGuide,
      nextStep,
      prevStep,
      skipGuide,
      completeGuide,
      goToStep,
    }),
    [completeGuide, goToStep, isActive, nextStep, prevStep, skipGuide, startGuide, step, stepIndex],
  )

  return (
    <MobileFirstLaunchGuideContext.Provider value={value}>
      {children}
    </MobileFirstLaunchGuideContext.Provider>
  )
}

export { isMobileFirstLaunchGuideCompleted }
