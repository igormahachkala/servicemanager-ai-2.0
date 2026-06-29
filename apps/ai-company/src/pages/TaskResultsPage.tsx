import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TaskResultCard,
  TaskResultFilters,
  TaskResultReviewPanel,
  TaskResultSummary,
  TaskResultTimeline,
} from '../components/task-results'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { PageGuideCard } from '../components/guided'
import { NextSuggestedActionsPanel } from '../components/work-scheduler'
import { useTaskResults } from '../hooks/useTaskResults'
import { useWorkScheduler } from '../hooks/useWorkScheduler'
import { useI18n } from '../i18n'

export function TaskResultsPage() {
  const { t } = useI18n()
  const { filtered, stats, query, setQuery, filter, setFilter, statuses, ...actions } =
    useTaskResults()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = useMemo(
    () => filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  )
  const { plan, approve, dismiss } = useWorkScheduler({
    taskResultId: selected?.id ?? null,
  })

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader title={t.pages.taskResults} description={t.taskResultEngine.pageDescription} />
        <Link to="/ops/notifications?type=task" className="mcBtn mcBtnSecondary">
          {t.taskResultEngine.openNotifications}
        </Link>
        <Link to="/ops/timeline" className="mcBtn mcBtnSecondary">
          {t.pages.companyTimeline}
        </Link>
        <Link to="/ops/reports" className="mcBtn mcBtnSecondary">
          {t.pages.reports}
        </Link>
        <Link to="/ops/runs" className="mcBtn mcBtnSecondary">
          {t.pages.runs}
        </Link>
      </div>

      <PageGuideCard pageId="taskResults" />

      <TaskResultSummary stats={stats} />

      <div style={{ marginTop: 16 }}>
        <Panel title={t.taskResultEngine.filtersTitle}>
        <div className="mcProfilePanelBody mcStack">
          <label className="mcField mcMemorySearch">
            <span className="mcFieldLabel">{t.taskResultEngine.searchLabel}</span>
            <input
              className="mcInput"
              type="search"
              value={query}
              placeholder={t.taskResultEngine.searchPlaceholder}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <TaskResultFilters filter={filter} onChange={setFilter} statuses={statuses} />
        </div>
      </Panel>
      </div>

      <div className="acTaskResultLayout">
        <Panel title={t.taskResultEngine.catalogTitle} right={<span className="mcMono mcMuted">{filtered.length}</span>}>
          <div className="acTaskResultList mcProfilePanelBody">
            {filtered.length === 0 ? (
              <p className="mcMuted">{t.taskResultEngine.empty}</p>
            ) : (
              filtered.map((result) => (
                <TaskResultCard
                  key={result.id}
                  result={result}
                  selected={selected?.id === result.id}
                  onSelect={setSelectedId}
                />
              ))
            )}
          </div>
        </Panel>

        <Panel title={t.taskResultEngine.previewTitle}>
          <div className="mcProfilePanelBody">
            {selected ? (
              <>
                <div className="acHandoffPreviewHead">
                  <h3>{selected.title}</h3>
                  <Link to={`/ops/task-results/${selected.id}`} className="mcBtn mcBtnSecondary mcBtnSm">
                    {t.taskResultEngine.openDetails}
                  </Link>
                </div>
                <p className="mcMuted">{selected.summary}</p>
                {selected.outputPreview ? (
                  <blockquote className="mcQuote">{selected.outputPreview}</blockquote>
                ) : null}
                <TaskResultReviewPanel
                  result={selected}
                  onApprove={(comment) => actions.approve(selected.id, comment)}
                  onRequestChanges={(comment) => actions.requestChanges(selected.id, comment)}
                  onReject={(comment) => actions.reject(selected.id, comment)}
                  onFollowUp={() => actions.createFollowUp(selected.id)}
                  onSendQa={(comment) => actions.sendToQa(selected.id, comment)}
                  onSendCodex={(comment) => actions.sendToCodex(selected.id, comment)}
                  onArchive={(comment) => actions.archive(selected.id, comment)}
                />
                <TaskResultTimeline result={selected} />
                <div style={{ marginTop: 16 }}>
                  <h4>{t.workScheduler.title}</h4>
                  <NextSuggestedActionsPanel
                    plan={plan}
                    compact
                    onApprove={approve}
                    onDismiss={dismiss}
                  />
                </div>
              </>
            ) : (
              <p className="mcMuted">{t.taskResultEngine.selectResult}</p>
            )}
          </div>
        </Panel>
      </div>

      <p className="mcReportPrincipleNote">{t.taskResultEngine.principleNote}</p>
      <p className="mcMemoryLocalNote">{t.taskResultEngine.localOnly}</p>
    </>
  )
}
