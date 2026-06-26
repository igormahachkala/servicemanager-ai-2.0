import type { HandoffResult } from '../../domain/handoff'
import { useI18n } from '../../i18n'

export function HandoffResultPanel({ result }: { result: HandoffResult }) {
  const { t } = useI18n()

  return (
    <div className="acHandoffResultPanel">
      <div className="acHandoffContextRow">
        <span>{t.handoffEngine.fields.deliveredAt}</span>
        <span className="mcMono">{result.deliveredAt}</span>
      </div>
      <p className="acHandoffContextSummary">{result.summary}</p>
      {result.responseFormat ? (
        <div className="acHandoffContextRow">
          <span>{t.handoffEngine.fields.responseFormat}</span>
          <span>{result.responseFormat}</span>
        </div>
      ) : null}
      {result.artifacts.length > 0 ? (
        <div className="acHandoffArtifactList">
          <span className="mcFieldLabel">{t.handoffEngine.fields.artifacts}</span>
          <ul>
            {result.artifacts.map((item) => (
              <li key={`${item.label}-${item.value}`}>
                <strong>{item.label}</strong>
                <span className="mcMono">{item.value}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {result.blockers.length > 0 ? (
        <div className="acHandoffBlockers">
          <span className="mcFieldLabel">{t.handoffEngine.fields.blockers}</span>
          <ul>
            {result.blockers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {result.notes ? <p className="mcMuted">{result.notes}</p> : null}
    </div>
  )
}
