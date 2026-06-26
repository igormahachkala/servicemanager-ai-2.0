import { useMemo, useState } from 'react'
import {
  isOllamaFastTestModel,
  OLLAMA_EXECUTION_TIMEOUT_MS,
  OLLAMA_MODEL_CATALOG,
  resolveCatalogModelIdFromOllamaTag,
  resolveOllamaModelTag,
} from '../../domain/runtime/providers/runtimeCapabilities'
import { formatElapsedMs } from '../../domain/runtime/providers/runtimeHealth'
import { getActiveRuntimeProviderId } from '../../domain/runtime/providers/runtimeAdapter'
import { loadRuntimeRuns } from '../../domain/runtime/runtimeOrchestrator'
import type { RuntimeRunRequest } from '../../domain/runtime/runtimeOrchestrator'
import { useRuntime } from '../../hooks/useRuntime'
import { useI18n } from '../../i18n'

type Props = {
  employeeId: string
  employeeName: string
  defaultModelId?: string
  taskType?: RuntimeRunRequest['taskType']
  onRunStarted?: (runId: string) => void
}

function isFirstRealOllamaRun(): boolean {
  if (getActiveRuntimeProviderId() !== 'ollama') return false
  return !loadRuntimeRuns().some(
    (run) => run.status === 'completed' && Boolean(run.result?.responseText),
  )
}

export function RuntimeExecutionPanel({
  employeeId,
  employeeName,
  defaultModelId = 'model-qwen-36-27b',
  taskType = 'conversation',
  onRunStarted,
}: Props) {
  const { t } = useI18n()
  const { startRun, cancelRun, executing, executionError, executionElapsedMs } = useRuntime()
  const activeProviderId = getActiveRuntimeProviderId()
  const isOllama = activeProviderId === 'ollama'
  const lightweightContext = isOllama && isFirstRealOllamaRun()

  const [prompt, setPrompt] = useState(
    `Atlas, summarize the current AI Company runtime state and propose the next operational step.`,
  )
  const [modelTag, setModelTag] = useState(resolveOllamaModelTag(defaultModelId))

  const catalogModelId = useMemo(
    () => resolveCatalogModelIdFromOllamaTag(modelTag),
    [modelTag],
  )
  const fastTestMode = isOllama && isOllamaFastTestModel(modelTag)

  const handleExecute = async () => {
    const run = await startRun({
      employeeId,
      workspaceId: null,
      taskType,
      prompt,
      ollamaModelTag: isOllama ? modelTag : null,
    })
    onRunStarted?.(run.id)
  }

  return (
    <div className="mcRuntimeExecutionPanel">
      <div className="mcRuntimeExecutionHead">
        <div>
          <h3 className="mcRuntimeAdapterTitle">{t.runtimeProviders.executionTitle}</h3>
          <p className="mcMuted">{t.runtimeProviders.executionDescription.replace('{name}', employeeName)}</p>
        </div>
        <div className="mcRuntimeExecutionBadges">
          <span className={`mcRuntimeAdapterStatus mcRuntimeAdapterStatus${isOllama ? 'Healthy' : 'Mock'}`}>
            {isOllama ? t.runtimeProviders.realExecution : t.runtimeProviders.mockExecution}
          </span>
          {fastTestMode ? (
            <span className="mcRuntimeAdapterStatus mcRuntimeAdapterStatusMock">
              {t.runtimeProviders.fastTestMode}
            </span>
          ) : null}
          {lightweightContext ? (
            <span className="mcRuntimeAdapterStatus mcRuntimeAdapterStatusDegraded">
              {t.runtimeProviders.lightweightContext}
            </span>
          ) : null}
        </div>
      </div>

      {isOllama ? (
        <label className="mcField">
          <span className="mcFieldLabel">{t.runtimeProviders.modelSelector}</span>
          <select className="mcSelect" value={modelTag} onChange={(event) => setModelTag(event.target.value)}>
            {OLLAMA_MODEL_CATALOG.map((item) => (
              <option key={item.tag} value={item.tag}>
                {item.label} · {item.tag}
                {isOllamaFastTestModel(item.tag) ? ` · ${t.runtimeProviders.fastTestTag}` : ''}
              </option>
            ))}
          </select>
          <span className="mcMono mcMuted">{catalogModelId}</span>
          {fastTestMode ? <p className="mcMuted">{t.runtimeProviders.fastTestModeNote}</p> : null}
          {lightweightContext ? <p className="mcMuted">{t.runtimeProviders.lightweightContextNote}</p> : null}
        </label>
      ) : null}

      <label className="mcField">
        <span className="mcFieldLabel">{t.runtimeProviders.promptLabel}</span>
        <textarea
          className="mcTextarea"
          rows={6}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
      </label>

      <div className="mcRuntimeExecutionActions">
        <button
          type="button"
          className="mcBtn mcBtnPrimary"
          disabled={executing || !prompt.trim()}
          onClick={() => void handleExecute()}
        >
          {executing ? t.runtimeProviders.executing : t.runtimeProviders.executePrompt}
        </button>
        {executing && isOllama ? (
          <button type="button" className="mcBtn mcBtnSecondary" onClick={() => void cancelRun()}>
            {t.runtimeProviders.cancelExecution}
          </button>
        ) : null}
      </div>

      {executing ? (
        <div className="mcRuntimeExecutionElapsed">
          <span className="mcFieldLabel">{t.runtimeProviders.elapsedTime}</span>
          <span className="mcMono">{formatElapsedMs(executionElapsedMs)}</span>
          <span className="mcMuted">
            {t.runtimeProviders.timeoutLimit.replace('{seconds}', String(OLLAMA_EXECUTION_TIMEOUT_MS / 1000))}
          </span>
        </div>
      ) : null}

      {executionError ? <p className="mcRuntimeExecutionError">{executionError}</p> : null}
      {!isOllama ? <p className="mcMuted">{t.runtimeProviders.mockExecutionNote}</p> : null}
    </div>
  )
}
