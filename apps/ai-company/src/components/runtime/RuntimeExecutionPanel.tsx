import { useEffect, useMemo, useState } from 'react'
import {
  OLLAMA_EXECUTION_TIMEOUT_MS,
} from '../../domain/runtime/providers/runtimeCapabilities'
import { getActiveRuntimeProviderId } from '../../domain/runtime/providers/runtimeAdapter'
import { formatElapsedMs } from '../../domain/runtime/providers/runtimeHealth'
import { loadRuntimeRuns } from '../../domain/runtime/runtimeOrchestrator'
import type { RuntimeRunRequest } from '../../domain/runtime/runtimeOrchestrator'
import {
  resolveRuntimeModelRoute,
  suggestRuntimeModelMode,
  type RuntimeModelMode,
} from '../../domain/runtime/runtimeModelRouting'
import { getOrCreateRuntimeProfile } from '../../domain/runtime/runtimeStorage'
import { RuntimeModelModeSelector } from '../task-runner/RuntimeModelModeSelector'
import { RuntimeModelRoutingPanel } from './RuntimeModelRoutingPanel'
import { useRuntime } from '../../hooks/useRuntime'
import { useI18n } from '../../i18n'

type Props = {
  employeeId: string
  employeeName: string
  defaultModelId?: string
  taskType?: RuntimeRunRequest['taskType']
  onRunStarted?: (runId: string) => void
  onPromptChange?: (prompt: string) => void
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
  taskType = 'conversation',
  onRunStarted,
  onPromptChange,
}: Props) {
  const { t } = useI18n()
  const { startRun, cancelRun, executing, executionError, executionElapsedMs } = useRuntime()
  const activeProviderId = getActiveRuntimeProviderId()
  const isOllama = activeProviderId === 'ollama'
  const lightweightContext = isOllama && isFirstRealOllamaRun()
  const profile = useMemo(() => getOrCreateRuntimeProfile(employeeId), [employeeId])

  const [prompt, setPrompt] = useState(
    `Atlas, summarize the current AI Company runtime state and propose the next operational step.`,
  )

  useEffect(() => {
    onPromptChange?.(prompt)
  }, [prompt, onPromptChange])
  const [modelMode, setModelMode] = useState<RuntimeModelMode>(() =>
    suggestRuntimeModelMode(employeeId),
  )

  const route = useMemo(
    () =>
      resolveRuntimeModelRoute({
        employeeId,
        profile,
        modelMode,
      }),
    [employeeId, profile, modelMode],
  )

  const handleExecute = async () => {
    const run = await startRun({
      employeeId,
      workspaceId: null,
      taskType,
      prompt,
      modelMode,
      ollamaModelTag: isOllama ? route.resolvedOllamaTag : null,
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
          {route.fastTestMode ? (
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
        <>
          <label className="mcField">
            <span className="mcFieldLabel">{t.runtimeModelRouting.runTaskModeTitle}</span>
            <RuntimeModelModeSelector
              employeeId={employeeId}
              modelMode={modelMode}
              onChange={setModelMode}
            />
          </label>
          <RuntimeModelRoutingPanel
            employeeId={employeeId}
            profile={profile}
            modelMode={modelMode}
            compact
          />
          {route.fastTestMode ? <p className="mcMuted">{t.runtimeProviders.fastTestModeNote}</p> : null}
          {lightweightContext ? <p className="mcMuted">{t.runtimeProviders.lightweightContextNote}</p> : null}
        </>
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
