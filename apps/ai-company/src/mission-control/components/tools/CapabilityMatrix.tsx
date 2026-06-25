import { TOOL_CAPABILITIES } from '../../data/toolCapabilities'
import type { ToolCapability } from '../../data/toolCapabilities'
import { useI18n } from '../../../i18n'

export function CapabilityMatrix(props: { enabled: ToolCapability[] }) {
  const { t } = useI18n()
  const enabledSet = new Set(props.enabled)

  return (
    <div className="mcToolMatrix">
      {TOOL_CAPABILITIES.map((capability) => {
        const active = enabledSet.has(capability)
        return (
          <div
            key={capability}
            className={active ? 'mcToolMatrixCell mcToolMatrixCellActive' : 'mcToolMatrixCell'}
          >
            <span className="mcToolMatrixLabel">{t.toolRegistry.capabilities[capability]}</span>
            <span className="mcToolMatrixState">
              {active ? t.toolRegistry.matrix.yes : t.toolRegistry.matrix.no}
            </span>
          </div>
        )
      })}
    </div>
  )
}
