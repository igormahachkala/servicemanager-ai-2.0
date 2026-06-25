import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { RunSteps } from '../components/run/RunSteps'
import { RunMetricsPanel } from '../components/run/RunMetrics'
import { RunArtifacts } from '../components/run/RunArtifacts'
import { RunWarnings } from '../components/run/RunWarnings'
import { RunTimeline } from '../components/run/RunTimeline'
import { RunContext } from '../components/run/RunContext'
import { useRunHistory } from '../hooks/useRunHistory'
import { resolveEmployee } from '../mission-control/data/conversation'
import { getWorkspaceById } from '../domain/workspaces/workspace'
import { useI18n } from '../i18n'

type RunDetailSection =
  | 'overview'
  | 'pipeline'
  | 'metrics'
  | 'artifacts'
  | 'warnings'
  | 'timeline'
  | 'context'

export function RunDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const { getById } = useRunHistory()
  const [section, setSection] = useState<RunDetailSection>('overview')

  const run = useMemo(() => (id ? getById(id) : null), [getById, id])

  const sections: RunDetailSection[] = [
    'overview',
    'pipeline',
    'metrics',
    'artifacts',
    'warnings',
    'timeline',
    'context',
  ]

  if (!run) {
    return (
      <>
        <PageHeader title={t.runEngine.notFoundTitle} description={t.runEngine.notFoundDescription} />
        <div className="mcRunEmpty">
          <Link to="/ops/runs" className="mcBtn mcBtnPrimary">
            {t.runEngine.backToList}
          </Link>
        </div>
      </>
    )
  }

  const employee = resolveEmployee(run.employeeId)
  const workspace = run.workspaceId ? getWorkspaceById(run.workspaceId) : null

  return (
    <div className="mcRunDetailsPage">
      <div className="mcOrgPageTop">
        <Link to="/ops/runs" className="mcBtn mcBtnSecondary mcBtnSmall">
          {t.runEngine.backToList}
        </Link>
      </div>

      <PageHeader
        title={`${employee?.codename ?? run.employeeId} · ${t.runEngine.runDetailsTitle}`}
        description={t.runEngine.runDetailsDescription}
      />

      <div className="mcRunDetailHeader mcMono mcMuted">
        <span>{run.id}</span>
        {run.runtimeRunId ? <span>{t.runEngine.runtimeRunId}: {run.runtimeRunId}</span> : null}
        <span>{t.runEngine.statuses[run.status]}</span>
      </div>

      <nav className="mcProfileNav" aria-label={t.runEngine.detailsNavLabel}>
        {sections.map((key) => (
          <button
            key={key}
            type="button"
            className={section === key ? 'mcProfileNavItem mcProfileNavItemActive' : 'mcProfileNavItem'}
            onClick={() => setSection(key)}
          >
            {t.runEngine.sections[key]}
          </button>
        ))}
      </nav>

      <div className="mcProfileContent">
        {section === 'overview' ? (
          <Panel title={t.runEngine.sections.overview}>
            <div className="mcProfilePanelBody">
              <div className="mcProfileFieldGrid">
                <div className="mcProfileField">
                  <div className="mcProfileFieldLabel">{t.labels.agent}</div>
                  <div className="mcProfileFieldValue">
                    <Link to={`/ops/employees/${run.employeeId}`}>{employee?.codename ?? run.employeeId}</Link>
                  </div>
                </div>
                <div className="mcProfileField">
                  <div className="mcProfileFieldLabel">{t.runEngine.filters.workspace}</div>
                  <div className="mcProfileFieldValue mcMono">
                    {workspace?.name ?? t.runEngine.platformWide}
                  </div>
                </div>
                <div className="mcProfileField">
                  <div className="mcProfileFieldLabel">{t.labels.model}</div>
                  <div className="mcProfileFieldValue mcMono">{run.modelId ?? t.common.empty}</div>
                </div>
                <div className="mcProfileField">
                  <div className="mcProfileFieldLabel">{t.runEngine.startedAt}</div>
                  <div className="mcProfileFieldValue">{new Date(run.startedAt).toLocaleString()}</div>
                </div>
                <div className="mcProfileField">
                  <div className="mcProfileFieldLabel">{t.runEngine.finishedAt}</div>
                  <div className="mcProfileFieldValue">
                    {run.finishedAt ? new Date(run.finishedAt).toLocaleString() : t.common.empty}
                  </div>
                </div>
                <div className="mcProfileField">
                  <div className="mcProfileFieldLabel">{t.reports.sections.evidence}</div>
                  <div className="mcProfileFieldValue">
                    {run.reportId ? (
                      <Link to={`/ops/reports/${run.reportId}`}>{run.reportId}</Link>
                    ) : (
                      t.common.empty
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        ) : null}

        {section === 'pipeline' ? (
          <Panel title={t.runEngine.sections.pipeline}>
            <div className="mcProfilePanelBody">
              <RunSteps steps={run.steps} />
            </div>
          </Panel>
        ) : null}

        {section === 'metrics' ? (
          <Panel title={t.runEngine.sections.metrics}>
            <div className="mcProfilePanelBody">
              <RunMetricsPanel metrics={run.metrics} />
            </div>
          </Panel>
        ) : null}

        {section === 'artifacts' ? (
          <Panel title={t.runEngine.sections.artifacts}>
            <div className="mcProfilePanelBody">
              <RunArtifacts artifacts={run.artifacts} />
            </div>
          </Panel>
        ) : null}

        {section === 'warnings' ? (
          <Panel title={t.runEngine.sections.warnings}>
            <div className="mcProfilePanelBody">
              <RunWarnings warnings={run.warnings} />
            </div>
          </Panel>
        ) : null}

        {section === 'timeline' ? (
          <Panel title={t.runEngine.sections.timeline}>
            <div className="mcProfilePanelBody">
              <RunTimeline entries={run.timeline} />
            </div>
          </Panel>
        ) : null}

        {section === 'context' ? (
          <Panel title={t.runEngine.sections.context}>
            <div className="mcProfilePanelBody">
              <RunContext layers={run.context} />
            </div>
          </Panel>
        ) : null}
      </div>

      <p className="mcReportPrincipleNote">{t.runEngine.principleNote}</p>
      <p className="mcMemoryLocalNote">{t.runEngine.localOnly}</p>
    </div>
  )
}
