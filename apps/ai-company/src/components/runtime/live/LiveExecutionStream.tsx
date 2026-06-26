import type { LiveStreamEntry } from '../../../hooks/useLiveRuntimeMonitor'
import { useI18n } from '../../../i18n'

type Props = {
  entries: LiveStreamEntry[]
  isLive: boolean
  elapsedLabel: string
  timeoutLabel: string
}

export function LiveExecutionStream({ entries, isLive, elapsedLabel, timeoutLabel }: Props) {
  const { t } = useI18n()

  return (
    <div className="mcLiveExecutionStream">
      <div className="mcLiveExecutionStreamHead">
        <div>
          <h3 className="mcRuntimeAdapterTitle">{t.runtimeLive.executionStream}</h3>
          <p className="mcMuted">{t.runtimeLive.executionStreamDescription}</p>
        </div>
        <div className="mcLiveExecutionStreamMetrics">
          {isLive ? <span className="mcLivePulse">{t.runtimeLive.liveBadge}</span> : null}
          <span className="mcMono">{t.runtimeLive.elapsed}: {elapsedLabel}</span>
          <span className="mcMono mcMuted">{t.runtimeLive.timeout}: {timeoutLabel}</span>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="mcMuted">{t.runtimeLive.streamEmpty}</p>
      ) : (
        <ul className="mcLiveExecutionStreamList">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className={`mcLiveExecutionStreamItem mcLiveExecutionStreamItem${capitalize(entry.level)}`}
            >
              <div className="mcLiveExecutionStreamMeta">
                <span className="mcMono mcMuted">{formatTime(entry.at)}</span>
                <span className="mcLiveExecutionStreamKind">{entry.kind}</span>
              </div>
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
