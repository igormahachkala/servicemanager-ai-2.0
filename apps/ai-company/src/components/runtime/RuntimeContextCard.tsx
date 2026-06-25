import type { RuntimeContext } from '../../domain/runtime/runtimeOrchestrator'
import { useI18n } from '../../i18n'

export function RuntimeContextCard({ context }: { context: RuntimeContext }) {
  const { t } = useI18n()

  return (
    <div className="mcRuntimeContextCard">
      <div className="mcRuntimeContextMeta mcMono mcMuted">
        {t.runtimeOrchestrator.contextBuiltAt}: {new Date(context.builtAt).toLocaleString()}
      </div>
      <ol className="mcRuntimeContextLayers">
        {context.layers.map((layer) => (
          <li key={layer.key} className="mcRuntimeContextLayer">
            <div className="mcRuntimeContextLayerHead">
              <strong>{t.runtimeOrchestrator.contextLayers[layer.key]}</strong>
              <span className="mcMono mcMuted">{layer.itemCount}</span>
            </div>
            <div className="mcRuntimeContextLayerSummary">{layer.summary}</div>
            {!layer.loaded ? (
              <span className="mcRuntimeContextLayerEmpty">{t.runtimeOrchestrator.notLoaded}</span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  )
}
