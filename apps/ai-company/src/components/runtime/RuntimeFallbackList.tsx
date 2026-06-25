import type { ModelSelection } from '../../domain/runtime/runtimeStorage'
import { getModelById, getProviderForModel } from '../../domain/runtime/runtimeStorage'
import { useI18n } from '../../i18n'

export function RuntimeFallbackList({ selection }: { selection: ModelSelection | null }) {
  const { t } = useI18n()

  if (!selection) {
    return (
      <div className="mcRuntimeEmpty">
        <div className="mcRuntimeEmptyTitle">{t.runtimeEngine.noSelectionTitle}</div>
        <p className="mcRuntimeEmptyDesc">{t.runtimeEngine.noSelectionDescription}</p>
      </div>
    )
  }

  const selectedModel = getModelById(selection.selectedModelId)
  const selectedProvider = getProviderForModel(selection.selectedModelId)

  return (
    <div className="mcRuntimeFallbackList">
      <div className="mcRuntimeSelectionPrimary">
        <div className="mcRuntimeSelectionLabel">{t.runtimeEngine.selectedModel}</div>
        <div className="mcRuntimeSelectionValue mcMono">
          {selectedModel?.name ?? selection.selectedModelId} ·{' '}
          {selectedProvider?.name ?? selection.selectedProviderId}
        </div>
        <div className="mcRuntimeSelectionReason">{selection.reason}</div>
        {selection.requiresApproval ? (
          <div className="mcRuntimeApprovalFlag">{t.runtimeEngine.requiresApproval}</div>
        ) : null}
      </div>

      {selection.fallbackChain.length > 0 ? (
        <div>
          <div className="mcRuntimeSelectionLabel">{t.runtimeEngine.fallbackChain}</div>
          <ol className="mcRuntimeFallbackChain">
            {selection.fallbackChain.map((item) => {
              const model = getModelById(item.modelId)
              const provider = getProviderForModel(item.modelId)
              return (
                <li key={item.modelId} className="mcMono">
                  {model?.name ?? item.modelId} · {provider?.name ?? item.providerId}
                </li>
              )
            })}
          </ol>
        </div>
      ) : (
        <p className="mcMuted">{t.runtimeEngine.noFallbackChain}</p>
      )}
    </div>
  )
}
