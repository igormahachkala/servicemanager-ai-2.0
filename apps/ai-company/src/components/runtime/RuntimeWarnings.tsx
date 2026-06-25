import type { RuntimeWarning } from '../../domain/runtime/runtimeOrchestrator'
import { useI18n } from '../../i18n'

export function RuntimeWarnings({ warnings }: { warnings: RuntimeWarning[] }) {
  const { t } = useI18n()

  if (warnings.length === 0) {
    return <p className="mcMuted">{t.runtimeOrchestrator.noWarnings}</p>
  }

  return (
    <ul className="mcRuntimeWarnings">
      {warnings.map((warning) => (
        <li
          key={warning.code}
          className={`mcRuntimeWarning mcRuntimeWarning${capitalize(warning.severity)}`}
        >
          <span className="mcMono">{warning.code}</span>
          <span>{warning.message}</span>
        </li>
      ))}
    </ul>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
