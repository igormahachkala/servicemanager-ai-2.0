import { useState } from 'react'
import type { CompanyEvent } from '../../../domain/events/event'
import type { RuntimeLogEntry } from '../../../domain/runtime/providers/runtimeHealth'
import type { RuntimePromptPreview } from '../../../domain/runtime/runtimePromptBuilder'
import type { RuntimeWarning } from '../../../domain/runtime/runtimeResult'
import { RuntimeLogs } from '../RuntimeLogs'
import { RuntimeWarnings } from '../RuntimeWarnings'
import { PromptPreviewPanel } from './PromptPreviewPanel'
import { useI18n } from '../../../i18n'

type Tab = 'logs' | 'events' | 'warnings' | 'prompt'

type Props = {
  runId: string | null
  logs: RuntimeLogEntry[]
  events: CompanyEvent[]
  warnings: RuntimeWarning[]
  promptPreview: RuntimePromptPreview | null
}

export function LiveRuntimeBottomPanel({ runId, logs, events, warnings, promptPreview }: Props) {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('logs')

  return (
    <div className="mcLiveRuntimeBottom">
      <div className="mcLiveRuntimeBottomTabs">
        <button
          type="button"
          className={`mcLiveRuntimeBottomTab${tab === 'logs' ? ' mcLiveRuntimeBottomTabActive' : ''}`}
          onClick={() => setTab('logs')}
        >
          {t.runtimeLive.tabs.logs}
        </button>
        <button
          type="button"
          className={`mcLiveRuntimeBottomTab${tab === 'events' ? ' mcLiveRuntimeBottomTabActive' : ''}`}
          onClick={() => setTab('events')}
        >
          {t.runtimeLive.tabs.events}
        </button>
        <button
          type="button"
          className={`mcLiveRuntimeBottomTab${tab === 'warnings' ? ' mcLiveRuntimeBottomTabActive' : ''}`}
          onClick={() => setTab('warnings')}
        >
          {t.runtimeLive.tabs.warnings}
        </button>
        <button
          type="button"
          className={`mcLiveRuntimeBottomTab${tab === 'prompt' ? ' mcLiveRuntimeBottomTabActive' : ''}`}
          onClick={() => setTab('prompt')}
        >
          {t.runtimeLive.tabs.promptPreview}
        </button>
      </div>

      <div className="mcLiveRuntimeBottomBody">
        {tab === 'logs' ? (
          runId ? <RuntimeLogs runId={runId} limit={20} /> : <p className="mcMuted">{t.runtimeLive.noRunSelected}</p>
        ) : null}
        {tab === 'events' ? (
          events.length === 0 ? (
            <p className="mcMuted">{t.runtimeLive.eventsEmpty}</p>
          ) : (
            <ul className="mcLiveRuntimeEventsList">
              {events.map((event) => (
                <li key={event.id} className="mcLiveRuntimeEventItem">
                  <span className="mcMono mcMuted">{new Date(event.createdAt).toLocaleTimeString()}</span>
                  <span>{event.type}</span>
                  <span className="mcMuted">{event.severity}</span>
                </li>
              ))}
            </ul>
          )
        ) : null}
        {tab === 'warnings' ? (
          warnings.length === 0 ? (
            <p className="mcMuted">{t.runtimeOrchestrator.noWarnings}</p>
          ) : (
            <RuntimeWarnings warnings={warnings} />
          )
        ) : null}
        {tab === 'prompt' ? <PromptPreviewPanel preview={promptPreview} /> : null}
        {tab === 'logs' && logs.length > 0 ? (
          <p className="mcMono mcMuted mcLiveRuntimeBottomCount">{logs.length}</p>
        ) : null}
      </div>
    </div>
  )
}
