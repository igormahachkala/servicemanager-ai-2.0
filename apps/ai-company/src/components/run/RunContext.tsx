import type { RunContextLayer } from '../../domain/run/runStorage'
import { useI18n } from '../../i18n'

export function RunContext({ layers }: { layers: RunContextLayer[] }) {
  const { t } = useI18n()

  if (layers.length === 0) {
    return <p className="mcMuted">{t.runEngine.emptyContext}</p>
  }

  return (
    <div className="mcRunContextGrid">
      {layers.map((layer) => (
        <div key={layer.key} className="mcRunContextCard">
          <div className="mcRunContextHead">
            <span className="mcRunContextLabel">{layer.label}</span>
            <span className={`mcRunContextLoaded ${layer.loaded ? 'mcRunContextLoadedYes' : 'mcRunContextLoadedNo'}`}>
              {layer.loaded ? t.runEngine.contextLoaded : t.runEngine.contextNotLoaded}
            </span>
          </div>
          <div className="mcRunContextSummary mcMuted">{layer.summary}</div>
          <div className="mcRunContextCount mcMono mcMuted">
            {layer.itemCount} {t.runEngine.contextItems}
          </div>
        </div>
      ))}
    </div>
  )
}
