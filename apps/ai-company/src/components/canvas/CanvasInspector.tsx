import { Link } from 'react-router-dom'
import type { CanvasNodeDetails, CanvasSummary } from '../../domain/canvas'
import { canvasNodeIcon } from './canvasNodeIcons'
import { ContextEmptyState } from '../empty-states'
import { LiveIndicator } from './LiveIndicator'
import { useI18n } from '../../i18n'

type Props = {
  details: CanvasNodeDetails | null
  summary: CanvasSummary
  selectedConnectionLabel: string | null
}

export function CanvasInspector({ details, summary, selectedConnectionLabel }: Props) {
  const { t } = useI18n()

  if (selectedConnectionLabel) {
    return (
      <div className="acCanvasInspector">
        <div className="acCanvasInspectorKind">{t.canvasEngine.connectionSelected}</div>
        <div className="acCanvasInspectorTitle">{selectedConnectionLabel}</div>
        <p className="acMuted">{t.canvasEngine.connectionSelectedHint}</p>
      </div>
    )
  }

  if (!details) {
    return (
      <div className="acCanvasInspector acCanvasInspectorEmpty">
        <ContextEmptyState area="canvas" variant="initial" compact className="acCanvasInspectorEmptyState" />

        <div className="acCanvasInspectorStats">
          <div className="acCanvasInspectorStat">
            <span>{summary.stats.employees}</span>
            <label>{t.canvasEngine.summaryEmployees}</label>
          </div>
          <div className="acCanvasInspectorStat">
            <span>{summary.stats.tasks}</span>
            <label>{t.canvasEngine.summaryTasks}</label>
          </div>
          <div className="acCanvasInspectorStat">
            <span>{summary.stats.approvals}</span>
            <label>{t.canvasEngine.summaryApprovals}</label>
          </div>
          <div className="acCanvasInspectorStat">
            <span>{summary.stats.runs}</span>
            <label>{t.canvasEngine.summaryRuns}</label>
          </div>
        </div>

        <InspectorSection title={t.canvasEngine.activeEmployees}>
          {summary.activeEmployees.length === 0 ? (
            <p className="acMuted">{t.canvasEngine.noActiveEmployees}</p>
          ) : (
            <ul className="acCanvasInspectorEntityList">
              {summary.activeEmployees.map((node) => (
                <li key={node.id}>
                  <span className="acCanvasInspectorEntityIcon">{canvasNodeIcon(node.kind)}</span>
                  <span>{node.label}</span>
                  {node.liveStatus ? <LiveIndicator status={node.liveStatus} compact /> : null}
                </li>
              ))}
            </ul>
          )}
        </InspectorSection>

        <InspectorSection title={t.canvasEngine.runningTasks}>
          {summary.runningTasks.length === 0 ? (
            <p className="acMuted">{t.canvasEngine.noRunningTasks}</p>
          ) : (
            <ul className="acCanvasInspectorEntityList">
              {summary.runningTasks.map((node) => (
                <li key={node.id}>
                  <span className="acCanvasInspectorEntityIcon">{canvasNodeIcon(node.kind)}</span>
                  <span>{node.label}</span>
                  {node.liveStatus ? <LiveIndicator status={node.liveStatus} compact /> : null}
                </li>
              ))}
            </ul>
          )}
        </InspectorSection>

        <InspectorSection title={t.canvasEngine.waitingApprovals}>
          {summary.waitingApprovals.length === 0 ? (
            <p className="acMuted">{t.canvasEngine.noWaitingApprovals}</p>
          ) : (
            <ul className="acCanvasInspectorEntityList">
              {summary.waitingApprovals.map((node) => (
                <li key={node.id}>
                  <span className="acCanvasInspectorEntityIcon">{canvasNodeIcon(node.kind)}</span>
                  <span>{node.label}</span>
                </li>
              ))}
            </ul>
          )}
        </InspectorSection>

        <InspectorSection title={t.canvasEngine.recentActivity}>
          {summary.recentEvents.length === 0 ? (
            <p className="acMuted">{t.canvasEngine.noRecentActivity}</p>
          ) : (
            <ul className="acCanvasInspectorEventList">
              {summary.recentEvents.map((event) => (
                <li key={event.id}>
                  <span className={`acCanvasTickerChip acCanvasTickerChip${capitalize(event.tone)}`}>
                    {event.message}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </InspectorSection>
      </div>
    )
  }

  const { node, inbound, outbound, relatedNodes, recentEvents } = details

  return (
    <div className="acCanvasInspector">
      <div className="acCanvasInspectorHead">
        <div className="acCanvasInspectorOverview">
          <span className="acCanvasInspectorEntityIcon acCanvasInspectorEntityIconLarge">
            {canvasNodeIcon(node.kind)}
          </span>
          <div>
            <div className="acCanvasInspectorKind">{t.canvasEngine.nodeKinds[node.kind]}</div>
            <div className="acCanvasInspectorTitle">{node.label}</div>
            {node.subtitle ? <div className="acMuted">{node.subtitle}</div> : null}
            {node.meta ? <div className="acCanvasNodeMeta">{node.meta}</div> : null}
          </div>
        </div>
        {node.liveStatus ? <LiveIndicator status={node.liveStatus} /> : null}
      </div>

      <InspectorSection title={t.canvasEngine.status}>
        <div className="acCanvasInspectorStatusRow">
          {node.liveStatus ? <LiveIndicator status={node.liveStatus} /> : <span className="acMuted">{t.canvasEngine.idleStatus}</span>}
        </div>
      </InspectorSection>

      {node.href ? (
        <Link to={node.href} className="acCanvasInspectorAction">
          {t.canvasEngine.openEntity}
        </Link>
      ) : null}

      {node.kind === 'runtime' || node.kind === 'run' ? (
        <Link to="/ops/runtime" className="acCanvasInspectorAction acCanvasInspectorActionSecondary">
          {t.canvasEngine.openRuntime}
        </Link>
      ) : null}

      {node.kind === 'tool' && node.href ? (
        <Link to={node.href} className="acCanvasInspectorAction acCanvasInspectorActionSecondary">
          {t.canvasEngine.openTool}
        </Link>
      ) : null}

      {node.kind === 'report' && node.href ? (
        <Link to={node.href} className="acCanvasInspectorAction acCanvasInspectorActionSecondary">
          {t.canvasEngine.openReport}
        </Link>
      ) : null}

      <InspectorSection title={t.canvasEngine.relatedEntities}>
        {relatedNodes.length === 0 ? (
          <p className="acMuted">{t.canvasEngine.noRelatedEntities}</p>
        ) : (
          <ul className="acCanvasInspectorEntityList">
            {relatedNodes.map((related) => (
              <li key={related.id}>
                <span className="acCanvasInspectorEntityIcon">{canvasNodeIcon(related.kind)}</span>
                {related.href ? (
                  <Link to={related.href} className="acLink">
                    {related.label}
                  </Link>
                ) : (
                  <span>{related.label}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </InspectorSection>

      <InspectorSection title={t.canvasEngine.recentEvents}>
        {recentEvents.length === 0 ? (
          <p className="acMuted">{t.canvasEngine.noRecentActivity}</p>
        ) : (
          <ul className="acCanvasInspectorEventList">
            {recentEvents.map((event) => (
              <li key={event.id}>{event.message}</li>
            ))}
          </ul>
        )}
      </InspectorSection>

      <InspectorSection title={t.canvasEngine.inbound}>
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
      </InspectorSection>

      <InspectorSection title={t.canvasEngine.outbound}>
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
      </InspectorSection>
    </div>
  )
}

function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="acCanvasInspectorSection">
      <div className="acCanvasInspectorSectionTitle">{title}</div>
      {children}
    </div>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
