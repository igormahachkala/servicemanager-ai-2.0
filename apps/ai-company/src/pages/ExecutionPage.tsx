import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ExecutionCard,
  ExecutionInspector,
  ExecutionQueue,
} from '../components/execution'
import { loadProjects } from '../domain/projects'
import { loadWorkspaces } from '../domain/workspaces/workspace'
import { AI_PHOTO_LAB_PROJECT_ID } from '../domain/projects/aiPhotoLabIds'
import { useExecution } from '../hooks/useExecution'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { useCustomEmployees } from '../mission-control/hooks/useCustomEmployees'
import { useI18n } from '../i18n'

export function ExecutionPage() {
  const { t } = useI18n()
  const { employees } = useCustomEmployees()
  const {
    queue,
    stats,
    nextTasks,
    runningNow,
    scope,
    setScope,
    selected,
    selectedId,
    setSelectedId,
    cancelExecution,
    retryExecution,
    completeExecution,
  } = useExecution({ kind: 'company' })

  const scopeOptions = useMemo(
    () => ({
      employees: employees.map((item) => ({ id: item.id, label: item.codename })),
      projects: loadProjects().map((item) => ({ id: item.id, label: item.title })),
      workspaces: loadWorkspaces().map((item) => ({ id: item.id, label: item.name })),
    }),
    [employees],
  )

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader
          title={t.pages.execution}
          description={t.executionEngine.pageDescription}
        />
        <Link to="/ops/sprint/sprint-apl-1" className="mcBtn mcBtnPrimary">
          {t.sprintEngine.openSprint}
        </Link>
        <Link to="/ops/run-task" className="mcBtn mcBtnPrimary">
          {t.taskRunner.actions.openRunTask}
        </Link>
        <Link
          to="/ops/projects/project-ai-photo-lab/control-room"
          className="mcBtn mcBtnPrimary"
        >
          {t.photoLabControlRoom.openControlRoom}
        </Link>
        <Link
          to={`/ops/projects/${encodeURIComponent(AI_PHOTO_LAB_PROJECT_ID)}`}
          className="mcBtn mcBtnSecondary"
        >
          {t.executionEngine.openPhotoLab}
        </Link>
        <Link to="/ops/handoffs" className="mcBtn mcBtnSecondary">
          {t.pages.handoffs}
        </Link>
      </div>

      <div className="mcExecStatsGrid">
        <div className="mcExecStatCard">
          <div className="mcExecStatValue">{stats.currentQueue}</div>
          <div className="mcExecStatLabel mcMuted">{t.executionEngine.stats.currentQueue}</div>
        </div>
        <div className="mcExecStatCard">
          <div className="mcExecStatValue">{nextTasks.length}</div>
          <div className="mcExecStatLabel mcMuted">{t.executionEngine.stats.nextTasks}</div>
        </div>
        <div className="mcExecStatCard">
          <div className="mcExecStatValue">{stats.runningNow}</div>
          <div className="mcExecStatLabel mcMuted">{t.executionEngine.stats.runningNow}</div>
        </div>
        <div className="mcExecStatCard">
          <div className="mcExecStatValue">{stats.completedToday}</div>
          <div className="mcExecStatLabel mcMuted">{t.executionEngine.stats.completedToday}</div>
        </div>
      </div>

      <div className="mcExecLayout">
        <div className="mcExecMain">
          <Panel
            title={t.executionEngine.queueTitle}
            right={
              <span className="mcMono mcMuted">
                {queue.length} {t.executionEngine.executionCount}
              </span>
            }
          >
            <div className="mcProfilePanelBody">
              <ExecutionQueue
                items={queue}
                scope={scope}
                onScopeChange={setScope}
                scopeOptions={scopeOptions}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
          </Panel>

          <div className="mcExecSplitPanels">
            <Panel title={t.executionEngine.runningNowTitle}>
              <div className="mcProfilePanelBody">
                {runningNow.length === 0 ? (
                  <p className="mcMuted">{t.executionEngine.runningNowEmpty}</p>
                ) : (
                  <div className="mcExecCardGrid mcExecCardGridCompact">
                    {runningNow.map((item) => (
                      <ExecutionCard
                        key={item.id}
                        execution={item}
                        selected={selectedId === item.id}
                        onSelect={setSelectedId}
                      />
                    ))}
                  </div>
                )}
              </div>
            </Panel>

            <Panel title={t.executionEngine.nextTasksTitle}>
              <div className="mcProfilePanelBody">
                {nextTasks.length === 0 ? (
                  <p className="mcMuted">{t.executionEngine.nextTasksEmpty}</p>
                ) : (
                  <div className="mcExecCardGrid mcExecCardGridCompact">
                    {nextTasks.map((item) => (
                      <ExecutionCard
                        key={item.id}
                        execution={item}
                        selected={selectedId === item.id}
                        onSelect={setSelectedId}
                      />
                    ))}
                  </div>
                )}
              </div>
            </Panel>
          </div>
        </div>

        <Panel title={t.executionEngine.inspectorTitle}>
          <div className="mcProfilePanelBody">
            <ExecutionInspector
              execution={selected}
              onCancel={cancelExecution}
              onRetry={retryExecution}
              onComplete={completeExecution}
            />
          </div>
        </Panel>
      </div>

      <p className="mcReportPrincipleNote">{t.executionEngine.principleNote}</p>
      <p className="mcMemoryLocalNote">{t.executionEngine.localOnly}</p>
    </>
  )
}
