import type { MobileTaskMode } from '../tasks/mobileComplexTaskPayload'
import { useI18n } from '../../i18n'

type MobileTaskModePickerProps = {
  mode: MobileTaskMode
  onChange: (mode: MobileTaskMode) => void
}

export function MobileTaskModePicker({ mode, onChange }: MobileTaskModePickerProps) {
  const { t } = useI18n()
  const copy = t.mobile.runTask.modes

  return (
    <div className="acMobileTaskModePicker" role="tablist" aria-label={copy.label}>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'quick'}
        className={
          mode === 'quick'
            ? 'acMobileTaskModePickerBtn acMobileTaskModePickerBtnActive'
            : 'acMobileTaskModePickerBtn'
        }
        onClick={() => onChange('quick')}
      >
        {copy.quick}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'complex'}
        className={
          mode === 'complex'
            ? 'acMobileTaskModePickerBtn acMobileTaskModePickerBtnActive'
            : 'acMobileTaskModePickerBtn'
        }
        onClick={() => onChange('complex')}
      >
        {copy.complex}
      </button>
    </div>
  )
}
