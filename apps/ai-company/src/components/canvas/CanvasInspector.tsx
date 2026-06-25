import { Link } from 'react-router-dom'
import type { CanvasInspectorModel } from '../../domain/canvas'
import { useI18n } from '../../i18n'
import { LiveIndicator } from './LiveIndicator'

type Props = {
  inspector: CanvasInspectorModel | null
}

export function CanvasInspector({ inspector }: Props) {
  const { t } = useI18n()

  if (!inspector) {
    return (
      <div className="acCanvasInspector acCanvasInspectorEmpty">
        <div className="acCanvasInspectorTitle">{t.canvasEngine.inspectorEmptyTitle}</div>
        <p className="acMuted">{t.canvasEngine.inspectorEmptyDescription}</p>
        <p className="acCanvasFutureNote">{t.canvasEngine.futureRealtime}</p>
      </div>
    )
  }

  const { node, inbound, outbound } = inspector

  return (
    <div className="acCanvasInspector">
      <div className="acCanvasInspectorHead">
        <div>
          <div className="acCanvasInspectorKind">{t.canvasEngine.nodeKinds[node.kind]}</div>
          <div className="acCanvasInspectorTitle">{node.label}</div>
          {node.subtitle ? <div className="acMuted">{node.subtitle}</div> : null}
        </div>
        {node.liveStatus ? <LiveIndicator status={node.liveStatus} /> : null}
      </div>

      {node.href ? (
        <Link to={node.href} className="acLink acCanvasInspectorLink">
          {t.canvasEngine.openEntity}
        </Link>
      ) : null}

      <div className="acCanvasInspectorSection">
        <div className="acCanvasInspectorSectionTitle">{t.canvasEngine.inbound}</div>
        {inbound.length === 0 ? (
          <p className="acMuted">{t.canvasEngine.noConnections}</p>
        ) : (
          <ul className="acCanvasInspectorList">
            {inbound.map((item) => (
              <li key={item.id}>
                <span className="acCanvasConnType">{t.canvasEngine.connectionTypes[item.type]}</span>
                {item.label ? <span className="acMuted"> · {item.label}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="acCanvasInspectorSection">
        <div className="acCanvasInspectorSectionTitle">{t.canvasEngine.outbound}</div>
        {outbound.length === 0 ? (
          <p className="acMuted">{t.canvasEngine.noConnections}</p>
        ) : (
          <ul className="acCanvasInspectorList">
            {outbound.map((item) => (
              <li key={item.id}>
                <span className="acCanvasConnType">{t.canvasEngine.connectionTypes[item.type]}</span>
                {item.label ? <span className="acMuted"> · {item.label}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="acCanvasFutureNote">{t.canvasEngine.futureWebSocket}</p>
    </div>
  )
}
