import { Link, useParams } from 'react-router-dom'
import {
  HandoffCard,
  HandoffChecklist,
  HandoffContextPanel,
  HandoffPackageView,
  HandoffResultPanel,
  HandoffTargetBadge,
} from '../components/handoff'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { useHandoffs } from '../hooks/useHandoffs'
import { useI18n } from '../i18n'

export function HandoffDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const handoffActions = useHandoffs()
  const handoff = id ? handoffActions.getById(id) : null

  if (!id || !handoff) {
    return (
      <>
        <PageHeader title={t.handoffEngine.notFoundTitle} description={t.handoffEngine.notFoundDescription} />
        <Link to="/ops/handoffs" className="mcBtn mcBtnPrimary">
          {t.handoffEngine.backToHandoffs}
        </Link>
      </>
    )
  }

  const mockReturn = () => {
    handoffActions.returnResult(handoff.id, {
      summary: 'Mock external result returned to AI Company.',
      responseFormat: handoff.package?.expectedResponseFormat ?? 'Markdown summary',
      artifacts: [{ label: 'Changed files', value: handoff.context.relatedPaths.join(', ') || 'n/a' }],
      blockers: [],
      notes: 'Mock return only — no Codex/Cursor API in V1.',
    })
  }

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader title={handoff.title} description={handoff.description} />
        <Link to="/ops/handoffs" className="mcBtn mcBtnSecondary">
          {t.handoffEngine.backToHandoffs}
        </Link>
        <Link to={`/ops/projects/${handoff.projectId}`} className="mcBtn mcBtnSecondary">
          {t.handoffEngine.openProject}
        </Link>
      </div>

      <div className="acHandoffDetailMeta">
        <HandoffTargetBadge target={handoff.target} />
        <span className={`acHandoffStatus acHandoffStatus${capitalize(handoff.status)}`}>
          {t.handoffEngine.statuses[handoff.status]}
        </span>
        <span className="mcMono mcMuted">{handoff.priority}</span>
      </div>

      <div className="acHandoffActionRow">
        {handoff.status === 'draft' ? (
          <button type="button" className="mcBtn mcBtnPrimary" onClick={() => handoffActions.prepare(handoff.id)}>
            {t.handoffEngine.actions.prepare}
          </button>
        ) : null}
        {handoff.status === 'ready' ? (
          <>
            <button type="button" className="mcBtn mcBtnSecondary" onClick={() => handoffActions.submitForApproval(handoff.id)}>
              {t.handoffEngine.actions.requestApproval}
            </button>
            <button type="button" className="mcBtn mcBtnPrimary" onClick={() => handoffActions.send(handoff.id)}>
              {t.handoffEngine.actions.send}
            </button>
          </>
        ) : null}
        {handoff.status === 'sent' ? (
          <button type="button" className="mcBtn mcBtnSecondary" onClick={() => handoffActions.markInProgress(handoff.id)}>
            {t.handoffEngine.actions.markInProgress}
          </button>
        ) : null}
        {handoff.status === 'in_progress' || handoff.status === 'sent' ? (
          <button type="button" className="mcBtn mcBtnPrimary" onClick={mockReturn}>
            {t.handoffEngine.actions.mockReturn}
          </button>
        ) : null}
        {handoff.status === 'returned' ? (
          <>
            <button type="button" className="mcBtn mcBtnPrimary" onClick={() => handoffActions.accept(handoff.id)}>
              {t.handoffEngine.actions.accept}
            </button>
            <button
              type="button"
              className="mcBtn mcBtnSecondary"
              onClick={() => handoffActions.reject(handoff.id, 'Needs revision before acceptance.')}
            >
              {t.handoffEngine.actions.reject}
            </button>
          </>
        ) : null}
        {!['accepted', 'rejected', 'cancelled'].includes(handoff.status) ? (
          <button type="button" className="mcBtn mcBtnSecondary" onClick={() => handoffActions.cancel(handoff.id)}>
            {t.handoffEngine.actions.cancel}
          </button>
        ) : null}
        {handoff.reportId ? (
          <Link to={`/ops/reports/${handoff.reportId}`} className="mcBtn mcBtnSecondary">
            {t.handoffEngine.openReport}
          </Link>
        ) : null}
      </div>

      <div className="mcGrid2">
        <Panel title={t.handoffEngine.sections.context}>
          <div className="mcProfilePanelBody">
            <HandoffContextPanel context={handoff.context} />
          </div>
        </Panel>
        <Panel title={t.handoffEngine.sections.instructions}>
          <div className="mcProfilePanelBody acStack">
            <p>{handoff.instructions}</p>
            <div className="acHandoffContextRow">
              <span>{t.handoffEngine.fields.expectedResult}</span>
              <span>{handoff.expectedResult}</span>
            </div>
            {handoff.constraints.length > 0 ? (
              <ul className="acHandoffPackageList">
                {handoff.constraints.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel title={t.handoffEngine.sections.checklist}>
        <div className="mcProfilePanelBody">
          <HandoffChecklist items={handoff.checklist} />
        </div>
      </Panel>

      <Panel title={t.handoffEngine.sections.package}>
        <div className="mcProfilePanelBody">
          {handoff.package ? (
            <HandoffPackageView handoffPackage={handoff.package} />
          ) : (
            <p className="mcMuted">{t.handoffEngine.packageNotReady}</p>
          )}
        </div>
      </Panel>

      {handoff.result ? (
        <Panel title={t.handoffEngine.sections.result}>
          <div className="mcProfilePanelBody">
            <HandoffResultPanel result={handoff.result} />
          </div>
        </Panel>
      ) : null}

      <Panel title={t.handoffEngine.relatedHandoffs}>
        <div className="acHandoffList mcProfilePanelBody">
          {handoffActions.filtered
            .filter((item) => item.projectId === handoff.projectId && item.id !== handoff.id)
            .slice(0, 4)
            .map((item) => (
              <HandoffCard key={item.id} handoff={item} compact />
            ))}
        </div>
      </Panel>
    </>
  )
}

function capitalize(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}
