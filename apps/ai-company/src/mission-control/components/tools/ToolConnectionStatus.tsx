import type { ToolConnectionStatus } from '../../data/tools'
import { useI18n } from '../../../i18n'

export function ToolConnectionStatus(props: { status: ToolConnectionStatus }) {
  const { t } = useI18n()
  const { status } = props

  return (
    <span className={`mcToolConn mcToolConn${capitalize(status)}`}>
      <span className="mcToolConnDot" aria-hidden />
      {t.toolRegistry.connectionStatus[status]}
    </span>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
