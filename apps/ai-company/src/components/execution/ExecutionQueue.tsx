import type { Execution, ExecutionQueueScope } from '../../domain/execution'
import { useI18n } from '../../i18n'
import { ExecutionCard } from './ExecutionCard'

type ExecutionQueueProps = {
  items: Execution[]
  scope: ExecutionQueueScope
  onScopeChange: (scope: ExecutionQueueScope) => void
  scopeOptions: {
    employees: Array<{ id: string; label: string }>
    projects: Array<{ id: string; label: string }>
    workspaces: Array<{ id: string; label: string }>
  }
  selectedId: string | null
  onSelect: (id: string) => void
}

export function ExecutionQueue({
  items,
  scope,
  onScopeChange,
  scopeOptions,
  selectedId,
  onSelect,
}: ExecutionQueueProps) {
  const { t } = useI18n()

  return (
    <div className="mcExecQueue">
      <div className="mcExecScopeRow">
        <label className="mcField mcExecScopeField">
          <span className="mcFieldLabel">{t.executionEngine.scope.label}</span>
          <select
            className="mcInput"
            value={scope.kind}
            onChange={(event) => {
              const kind = event.target.value as ExecutionQueueScope['kind']
              if (kind === 'company') onScopeChange({ kind: 'company' })
              else if (kind === 'employee' && scopeOptions.employees[0]) {
                onScopeChange({ kind: 'employee', employeeId: scopeOptions.employees[0].id })
              } else if (kind === 'project' && scopeOptions.projects[0]) {
                onScopeChange({ kind: 'project', projectId: scopeOptions.projects[0].id })
              } else if (kind === 'workspace' && scopeOptions.workspaces[0]) {
                onScopeChange({ kind: 'workspace', workspaceId: scopeOptions.workspaces[0].id })
              }
            }}
          >
            <option value="company">{t.executionEngine.scope.company}</option>
            <option value="employee">{t.executionEngine.scope.employee}</option>
            <option value="project">{t.executionEngine.scope.project}</option>
            <option value="workspace">{t.executionEngine.scope.workspace}</option>
          </select>
        </label>

        {scope.kind === 'employee' ? (
          <label className="mcField mcExecScopeField">
            <span className="mcFieldLabel">{t.executionEngine.scope.employee}</span>
            <select
              className="mcInput"
              value={scope.employeeId}
              onChange={(event) =>
                onScopeChange({ kind: 'employee', employeeId: event.target.value })
              }
            >
              {scopeOptions.employees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {scope.kind === 'project' ? (
          <label className="mcField mcExecScopeField">
            <span className="mcFieldLabel">{t.executionEngine.scope.project}</span>
            <select
              className="mcInput"
              value={scope.projectId}
              onChange={(event) =>
                onScopeChange({ kind: 'project', projectId: event.target.value })
              }
            >
              {scopeOptions.projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {scope.kind === 'workspace' ? (
          <label className="mcField mcExecScopeField">
            <span className="mcFieldLabel">{t.executionEngine.scope.workspace}</span>
            <select
              className="mcInput"
              value={scope.workspaceId}
              onChange={(event) =>
                onScopeChange({ kind: 'workspace', workspaceId: event.target.value })
              }
            >
              {scopeOptions.workspaces.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="mcExecEmpty">
          <div className="mcExecEmptyTitle">{t.executionEngine.emptyQueueTitle}</div>
          <p className="mcExecEmptyDesc">{t.executionEngine.emptyQueueDescription}</p>
        </div>
      ) : (
        <div className="mcExecCardGrid">
          {items.map((item) => (
            <ExecutionCard
              key={item.id}
              execution={item}
              selected={selectedId === item.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}
