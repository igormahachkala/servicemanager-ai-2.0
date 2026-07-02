import { useHelpCenter } from '../../hooks/useHelpCenter'
import { useI18n } from '../../i18n'

export function HelpCenterButton() {
  const { t } = useI18n()
  const { openHelpCenter } = useHelpCenter()

  return (
    <button
      type="button"
      className="acHelpCenterBtn"
      aria-label={t.guidedExperience.helpCenter.openAria}
      title={t.guidedExperience.helpCenter.title}
      onClick={() => openHelpCenter()}
    >
      ?
    </button>
  )
}
