import type { RunWarning } from '../../domain/run/runStorage'
import { useI18n } from '../../i18n'

function severityClass(severity: RunWarning['severity']): string {
  if (severity === 'error') return 'mcRunWarningError'
  if (severity === 'warn') return 'mcRunWarningWarn'
  return 'mcRunWarningInfo'
}

export function RunWarnings({ warnings }: { warnings: RunWarning[] }) {
  const { t } = useI18n()

  if (warnings.length === 0) {
    return <p className="mcMuted">{t.runEngine.emptyWarnings}</p>
  }

  return (
    <div className="mcRunWarningList">
      {warnings.map((warning) => (
        <div key={warning.id} className={`mcRunWarningRow ${severityClass(warning.severity)}`}>
          <span className="mcRunWarningCode mcMono">{warning.code}</span>
          <span className="mcRunWarningSeverity">{t.runEngine.warningSeverities[warning.severity]}</span>
          <p className="mcRunWarningMessage">{warning.message}</p>
        </div>
      ))}
    </div>
  )
}
