import { useEffect, useState } from 'react'
import { loadRuntimeLogs, type RuntimeLogEntry } from '../../domain/runtime/providers/runtimeHealth'
import { useI18n } from '../../i18n'

type Props = {
  runId?: string | null
  limit?: number
}

export function RuntimeLogs({ runId = null, limit = 12 }: Props) {
  const { t } = useI18n()
  const [logs, setLogs] = useState<RuntimeLogEntry[]>(() => loadRuntimeLogs())

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLogs(loadRuntimeLogs())
    }, 1500)
    return () => window.clearInterval(timer)
  }, [])

  const filtered = runId ? logs.filter((item) => item.runId === runId) : logs
  const visible = filtered.slice(0, limit)

  return (
    <div className="mcRuntimeLogs">
      <div className="mcRuntimeLogsHead">
        <h3 className="mcRuntimeAdapterTitle">{t.runtimeProviders.logsTitle}</h3>
        <span className="mcMono mcMuted">{visible.length}</span>
      </div>
      {visible.length === 0 ? (
        <p className="mcMuted">{t.runtimeProviders.logsEmpty}</p>
      ) : (
        <ul className="mcRuntimeLogsList">
          {visible.map((entry) => (
            <li key={entry.id} className={`mcRuntimeLogItem mcRuntimeLogItem${capitalize(entry.level)}`}>
              <span className="mcMono mcMuted">{formatTime(entry.at)}</span>
              <span>{entry.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString()
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
