import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Card } from '../components/layout'
import {
  ToolApprovalPanel,
  ToolExecutionLog,
  ToolRequestCard,
  ToolResultViewer,
} from '../components/toolExecution'
import { createToolRequestApproval } from '../domain/toolExecution'
import { useToolExecution } from '../hooks/useToolExecution'
import { useI18n } from '../i18n'
import { toolExecutionStatusLabel } from '../i18n/uiLabels'

export function ToolExecutionsPage() {
  const { t } = useI18n()
  const {
    filtered,
    stats,
    filter,
    setFilter,
    submit,
    approve,
    reject,
    cancel,
    providers,
    statuses,
    employeeIds,
  } = useToolExecution()

  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedExecution = useMemo(
    () => filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  )

  const submitSample = () => {
    const requiresApproval = true
    const created = submit({
      employeeId: 'ag-cto',
      toolId: 'tool-github',
      provider: 'mock',
      action: 'review_repository',
      arguments: {
        repository: 'servicemanager-ai-2.0',
        branch: 'main',
      },
      approval: createToolRequestApproval(requiresApproval, `approval-${Date.now()}`),
    })
    setSelectedId(created.id)
  }

  return (
    <>
      <PageHeader
        title={t.pages.toolExecutions}
        description={t.toolExecutionEngine.pageDescription}
        actions={
          <>
            <Link to="/ops/handoffs" className="mcBtn mcBtnSecondary">
              {t.pages.handoffs}
            </Link>
            <button className="mcBtn mcBtnPrimary" type="button" onClick={submitSample}>
              {t.toolExecutionEngine.submitSample}
            </button>
          </>
        }
      />

      <div className="mcGrid4" style={{ marginBottom: 16 }}>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.toolExecutionEngine.stats.total}</div>
          <div className="mcMetricValue">{stats.total}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.toolExecutionEngine.stats.waitingApproval}</div>
          <div className="mcMetricValue">{stats.waitingApproval}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.toolExecutionEngine.stats.completed}</div>
          <div className="mcMetricValue">{stats.completed}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.toolExecutionEngine.stats.failedCancelled}</div>
          <div className="mcMetricValue">{stats.failed + stats.cancelled}</div>
        </div>
      </div>

      <Card title={t.toolExecutionEngine.filters.title}>
        <div className="acToolExecutionFilters">
          <label className="mcField">
            <span className="mcFieldLabel">{t.toolExecutionEngine.filters.employee}</span>
            <select
              className="mcSelect"
              value={filter.employeeId}
              onChange={(event) => setFilter((prev) => ({ ...prev, employeeId: event.target.value }))}
            >
              {employeeIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>

          <label className="mcField">
            <span className="mcFieldLabel">{t.toolExecutionEngine.filters.provider}</span>
            <select
              className="mcSelect"
              value={filter.provider}
              onChange={(event) => setFilter((prev) => ({ ...prev, provider: event.target.value as typeof prev.provider }))}
            >
              {providers.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
          </label>

          <label className="mcField">
            <span className="mcFieldLabel">{t.toolExecutionEngine.filters.status}</span>
            <select
              className="mcSelect"
              value={filter.status}
              onChange={(event) => setFilter((prev) => ({ ...prev, status: event.target.value as typeof prev.status }))}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {toolExecutionStatusLabel(t, status)}
                </option>
              ))}
            </select>
          </label>

          <label className="mcField">
            <span className="mcFieldLabel">{t.toolExecutionEngine.filters.approval}</span>
            <select
              className="mcSelect"
              value={filter.approval}
              onChange={(event) => setFilter((prev) => ({ ...prev, approval: event.target.value as typeof prev.approval }))}
            >
              <option value="all">{t.toolExecutionEngine.filters.all}</option>
              <option value="required">{t.toolExecutionEngine.filters.required}</option>
              <option value="not_required">{t.toolExecutionEngine.filters.notRequired}</option>
            </select>
          </label>
        </div>
      </Card>

      <div className="mcGrid2" style={{ marginTop: 16 }}>
        <Card
          title={t.toolExecutionEngine.log.title}
          action={
            <span className="mcMono mcMuted">
              {t.toolExecutionEngine.log.items.replace('{count}', String(filtered.length))}
            </span>
          }
        >
          <ToolExecutionLog executions={filtered} selectedId={selectedExecution?.id ?? null} onSelect={setSelectedId} />
        </Card>

        <Card title={t.toolExecutionEngine.details.title}>
          {selectedExecution ? (
            <>
              <ToolRequestCard execution={selectedExecution} />
              <ToolApprovalPanel execution={selectedExecution} onApprove={approve} onReject={reject} onCancel={cancel} />
              <ToolResultViewer execution={selectedExecution} />
            </>
          ) : (
            <div className="mcMuted">{t.toolExecutionEngine.log.selectHint}</div>
          )}
        </Card>
      </div>

      <p className="mcMemoryLocalNote">{t.toolExecutionEngine.localNote}</p>
    </>
  )
}
