import { useMemo, useState } from 'react'
import {
  OLLAMA_MODEL_CATALOG,
  resolveCatalogModelIdFromOllamaTag,
  resolveOllamaModelTag,
} from '../../domain/runtime/providers/runtimeCapabilities'
import { getActiveRuntimeProviderId } from '../../domain/runtime/providers/runtimeAdapter'
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

export function RuntimeExecutionPanel({
  employeeId,
  employeeName,
  defaultModelId = 'model-qwen-36-27b',
  taskType = 'conversation',
  onRunStarted,
}: Props) {
  const { t } = useI18n()
  const { startRun, executing, executionError } = useRuntime()
  const activeProviderId = getActiveRuntimeProviderId()
  const isOllama = activeProviderId === 'ollama'

  const [prompt, setPrompt] = useState(
    `Atlas, summarize the current AI Company runtime state and propose the next operational step.`,
  )
  const [modelTag, setModelTag] = useState(resolveOllamaModelTag(defaultModelId))

  const catalogModelId = useMemo(
    () => resolveCatalogModelIdFromOllamaTag(modelTag),
    [modelTag],
  )

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
        <span className={`mcRuntimeAdapterStatus mcRuntimeAdapterStatus${isOllama ? 'Healthy' : 'Mock'}`}>
          {isOllama ? t.runtimeProviders.realExecution : t.runtimeProviders.mockExecution}
        </span>
      </div>

      {isOllama ? (
        <label className="mcField">
          <span className="mcFieldLabel">{t.runtimeProviders.modelSelector}</span>
          <select className="mcSelect" value={modelTag} onChange={(event) => setModelTag(event.target.value)}>
            {OLLAMA_MODEL_CATALOG.map((item) => (
              <option key={item.tag} value={item.tag}>
                {item.label} · {item.tag}
              </option>
            ))}
          </select>
          <span className="mcMono mcMuted">{catalogModelId}</span>
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
      </div>

      {executionError ? <p className="mcRuntimeExecutionError">{executionError}</p> : null}
      {!isOllama ? <p className="mcMuted">{t.runtimeProviders.mockExecutionNote}</p> : null}
    </div>
  )
}
