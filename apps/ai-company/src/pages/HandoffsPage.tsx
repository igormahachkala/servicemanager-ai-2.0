import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  HandoffCard,
  HandoffChecklist,
  HandoffContextPanel,
  HandoffPackageView,
  HandoffResultPanel,
} from '../components/handoff'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { AI_PHOTO_LAB_PROJECT_ID } from '../domain/projects/aiPhotoLabIds'
import { useHandoffs } from '../hooks/useHandoffs'
import { useI18n } from '../i18n'

export function HandoffsPage() {
  const { t } = useI18n()
  const {
    filtered,
    stats,
    filter,
    setFilter,
    targets,
    statuses,
    templates,
    createFromTemplate,
    prepare,
    refresh,
  } = useHandoffs()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = useMemo(
    () => filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  )

  const createSample = () => {
    const created = createFromTemplate({
      templateId: 'tpl-codex-code-task',
      projectId: AI_PHOTO_LAB_PROJECT_ID,
      workspaceId: 'workspace-ai-photo-lab',
      employeeId: 'ag-max',
      titleOverride: 'Sample Codex handoff',
      relatedPaths: ['apps/ai-company/src/domain/handoff/'],
    })
    prepare(created.id)
    setSelectedId(created.id)
    refresh()
  }

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader title={t.pages.handoffs} description={t.handoffEngine.pageDescription} />
        <Link to={`/ops/projects/${AI_PHOTO_LAB_PROJECT_ID}`} className="mcBtn mcBtnSecondary">
          {t.handoffEngine.openPhotoLab}
        </Link>
        <button type="button" className="mcBtn mcBtnPrimary" onClick={createSample}>
          {t.handoffEngine.createSample}
        </button>
      </div>

      <div className="mcGrid4" style={{ marginBottom: 16 }}>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.handoffEngine.stats.total}</div>
          <div className="mcMetricValue">{stats.total}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.handoffEngine.stats.ready}</div>
          <div className="mcMetricValue">{stats.ready}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.handoffEngine.stats.inProgress}</div>
          <div className="mcMetricValue">{stats.inProgress + stats.sent}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.handoffEngine.stats.accepted}</div>
          <div className="mcMetricValue">{stats.accepted}</div>
        </div>
      </div>

      <Panel title={t.handoffEngine.filtersTitle}>
        <div className="acHandoffFilters mcProfilePanelBody">
          <label className="mcField">
            <span className="mcFieldLabel">{t.handoffEngine.fields.target}</span>
            <select
              value={filter.target}
              onChange={(event) => setFilter({ ...filter, target: event.target.value as typeof filter.target })}
            >
              {targets.map((target) => (
                <option key={target} value={target}>
                  {target === 'all' ? t.common.all : t.handoffEngine.targets[target]}
                </option>
              ))}
            </select>
          </label>
          <label className="mcField">
            <span className="mcFieldLabel">{t.handoffEngine.fields.status}</span>
            <select
              value={filter.status}
              onChange={(event) => setFilter({ ...filter, status: event.target.value as typeof filter.status })}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status === 'all' ? t.common.all : t.handoffEngine.statuses[status]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Panel>

      <div className="acHandoffLayout">
        <Panel title={t.handoffEngine.catalogTitle} right={<span className="mcMono mcMuted">{filtered.length}</span>}>
          <div className="acHandoffList mcProfilePanelBody">
            {filtered.length === 0 ? (
              <p className="mcMuted">{t.handoffEngine.empty}</p>
            ) : (
              filtered.map((handoff) => (
                <HandoffCard
                  key={handoff.id}
                  handoff={handoff}
                  selected={selected?.id === handoff.id}
                  onSelect={setSelectedId}
                />
              ))
            )}
          </div>
        </Panel>

        <Panel title={t.handoffEngine.previewTitle}>
          <div className="mcProfilePanelBody acHandoffPreview">
            {selected ? (
              <>
                <div className="acHandoffPreviewHead">
                  <h3>{selected.title}</h3>
                  <Link to={`/ops/handoffs/${selected.id}`} className="mcBtn mcBtnSecondary mcBtnSm">
                    {t.handoffEngine.openDetails}
                  </Link>
                </div>
                <HandoffContextPanel context={selected.context} />
                <HandoffChecklist items={selected.checklist} />
                {selected.package ? <HandoffPackageView handoffPackage={selected.package} /> : null}
                {selected.result ? <HandoffResultPanel result={selected.result} /> : null}
              </>
            ) : (
              <p className="mcMuted">{t.handoffEngine.selectHandoff}</p>
            )}
          </div>
        </Panel>
      </div>

      <Panel title={t.handoffEngine.templatesTitle}>
        <div className="acHandoffTemplateGrid mcProfilePanelBody">
          {templates.map((template) => (
            <article key={template.id} className="acHandoffTemplateCard">
              <h4>{template.name}</h4>
              <p className="mcMuted">{template.description}</p>
              <span className="mcMono mcMuted">{template.target}</span>
            </article>
          ))}
        </div>
      </Panel>

      <p className="mcReportPrincipleNote">{t.handoffEngine.principleNote}</p>
      <p className="mcMemoryLocalNote">{t.handoffEngine.localOnly}</p>
    </>
  )
}
