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
        description="Single gateway for tool requests. Mock provider only, no real execution."
        actions={
          <>
            <Link to="/ops/handoffs" className="mcBtn mcBtnSecondary">
              {t.pages.handoffs}
            </Link>
            <button className="mcBtn mcBtnPrimary" type="button" onClick={submitSample}>
              Submit sample request
            </button>
          </>
        }
      />

      <div className="mcGrid4" style={{ marginBottom: 16 }}>
        <div className="mcMetric">
          <div className="mcMetricLabel">Total</div>
          <div className="mcMetricValue">{stats.total}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">Waiting approval</div>
          <div className="mcMetricValue">{stats.waitingApproval}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">Completed</div>
          <div className="mcMetricValue">{stats.completed}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">Failed/Cancelled</div>
          <div className="mcMetricValue">{stats.failed + stats.cancelled}</div>
        </div>
      </div>

      <Card title="Filters">
        <div className="acToolExecutionFilters">
          <label className="mcField">
            <span className="mcFieldLabel">Employee</span>
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
            <span className="mcFieldLabel">Provider</span>
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
            <span className="mcFieldLabel">Status</span>
            <select
              className="mcSelect"
              value={filter.status}
              onChange={(event) => setFilter((prev) => ({ ...prev, status: event.target.value as typeof prev.status }))}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="mcField">
            <span className="mcFieldLabel">Approval</span>
            <select
              className="mcSelect"
              value={filter.approval}
              onChange={(event) => setFilter((prev) => ({ ...prev, approval: event.target.value as typeof prev.approval }))}
            >
              <option value="all">all</option>
              <option value="required">required</option>
              <option value="not_required">not_required</option>
            </select>
          </label>
        </div>
      </Card>

      <div className="mcGrid2" style={{ marginTop: 16 }}>
        <Card title="Execution log" action={<span className="mcMono mcMuted">{filtered.length} items</span>}>
          <ToolExecutionLog executions={filtered} selectedId={selectedExecution?.id ?? null} onSelect={setSelectedId} />
        </Card>

        <Card title="Execution details">
          {selectedExecution ? (
            <>
              <ToolRequestCard execution={selectedExecution} />
              <ToolApprovalPanel execution={selectedExecution} onApprove={approve} onReject={reject} onCancel={cancel} />
              <ToolResultViewer execution={selectedExecution} />
            </>
          ) : (
            <div className="mcMuted">Select execution from log.</div>
          )}
        </Card>
      </div>

      <p className="mcMemoryLocalNote">Local mock flow only. No real provider calls are executed.</p>
    </>
  )
}
