import {
  listRuntimeModelModesForEmployee,
  type RuntimeModelMode,
} from '../../domain/runtime/runtimeModelRouting'
import { useI18n } from '../../i18n'

type Props = {
  employeeId: string
  modelMode: RuntimeModelMode
  onChange: (mode: RuntimeModelMode) => void
}

export function RuntimeModelModeSelector({ employeeId, modelMode, onChange }: Props) {
  const { t } = useI18n()
  const modes = listRuntimeModelModesForEmployee(employeeId)

  return (
    <div className="mcTaskRunnerModeGrid">
      {modes.map((item) => {
        const active = item === modelMode
        return (
          <button
            key={item}
            type="button"
            className={`mcTaskRunnerModeChip ${active ? 'active' : ''}`}
            onClick={() => onChange(item)}
          >
            <span>{t.runtimeModelRouting.modes[item]}</span>
            <span className="mcTaskRunnerModeHint">{t.runtimeModelRouting.modeHints[item]}</span>
          </button>
        )
      })}
    </div>
  )
}
