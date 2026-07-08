import { useI18n } from '../../i18n'
import type { MobileFirstLaunchGuideStepId } from '../guide/mobileFirstLaunchGuideConfig'

type Props = {
  stepId: MobileFirstLaunchGuideStepId
  stepIndex: number
  stepCount: number
  onBack: () => void
  onNext: () => void
  onSkip: () => void
  onOpenMax: () => void
  onAssignFirstTask: () => void
  onCloseGuide: () => void
}

export function MobileFirstLaunchGuidePanel({
  stepId,
  stepIndex,
  stepCount,
  onBack,
  onNext,
  onSkip,
  onOpenMax,
  onAssignFirstTask,
  onCloseGuide,
}: Props) {
  const { t } = useI18n()
  const copy = t.mobile.firstLaunchGuide
  const stepCopy = copy.steps[stepId]
  const actions = copy.actions
  const isFirst = stepIndex === 0
  const isLast = stepIndex === stepCount - 1

  const primaryLabel =
    stepId === 'employees'
      ? actions.openMax
      : isLast
        ? actions.assignFirstTask
        : isFirst
          ? actions.next
          : actions.next

  const handlePrimary = () => {
    if (stepId === 'employees') {
      onOpenMax()
      return
    }
    if (isLast) {
      onAssignFirstTask()
      return
    }
    onNext()
  }

  return (
    <div className="acMobileGuidePanel">
      <p className="acMobileGuideStepCounter">
        {copy.stepCounter
          .replace('{current}', String(stepIndex + 1))
          .replace('{total}', String(stepCount))}
      </p>

      <h3 className="acMobileGuideTitle">{stepCopy.title}</h3>

      <ul className="acMobileGuideBullets">
        {stepCopy.body.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <div className="acMobileGuideActions">
        <div className="acMobileGuideActionsRow">
          {!isFirst ? (
            <button type="button" className="acMobileSecondaryBtn acMobileGuideBtn" onClick={onBack}>
              {actions.back}
            </button>
          ) : (
            <span className="acMobileGuideBtnSpacer" aria-hidden />
          )}

          <button type="button" className="acMobileTertiaryLinkBtn acMobileGuideSkipBtn" onClick={onSkip}>
            {actions.skip}
          </button>
        </div>

        <button type="button" className="acMobilePrimaryBtn acMobileGuidePrimaryBtn" onClick={handlePrimary}>
          {primaryLabel}
        </button>

        {isLast ? (
          <button type="button" className="acMobileSecondaryBtn acMobileGuideSecondaryBtn" onClick={onCloseGuide}>
            {actions.closeGuide}
          </button>
        ) : null}
      </div>
    </div>
  )
}
