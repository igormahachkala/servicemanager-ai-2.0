import { Link } from 'react-router-dom'
import {
  PageHeader,
  Panel,
  StatusDot,
  agentStatusClass,
  loadFillClass,
} from '../components/ui'
import { activeAgents, plannedAgents } from '../data/mock'
import {
  customEmployeeToAgent,
  optionLabel,
  summarizePermissions,
  type CustomEmployee,
} from '../data/customEmployees'
import { useCustomEmployees } from '../hooks/useCustomEmployees'
import type { Agent } from '../data/types'
import { useI18n } from '../../i18n'

function statusDotKind(status: string, lifecycle: string): 'green' | 'amber' | 'red' | 'gray' {
  if (lifecycle === 'planned') return 'gray'
  if (status === 'online' || status === 'busy') return 'green'
  if (status === 'idle') return 'gray'
  return 'gray'
}

function TagList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <span className="mcMuted">{emptyLabel}</span>
  }

  return (
    <div className="mcTagRow">
      {items.map((item) => (
        <span key={item} className="mcTag">
          {item}
        </span>
      ))}
    </div>
  )
}

function CustomEmployeeDetailTable({ rows }: { rows: CustomEmployee[] }) {
  const { t } = useI18n()
  const permissionLabels = {
    permissionLabels: t.employeeBuilder.options.permissions,
    readShort: t.employeeBuilder.permissions.readShort,
    writeShort: t.employeeBuilder.permissions.writeShort,
    readWriteShort: t.employeeBuilder.permissions.readWriteShort,
    empty: t.common.empty,
  }

  return (
    <table className="mcTable">
      <thead>
        <tr>
          <th>{t.labels.agent}</th>
          <th>{t.labels.role}</th>
          <th>{t.labels.status}</th>
          <th>{t.employeeBuilder.fields.skills}</th>
          <th>{t.employeeBuilder.sections.tools}</th>
          <th>{t.employeeBuilder.sections.permissions}</th>
          <th>{t.employeeBuilder.sections.restrictions}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((employee) => (
          <tr key={employee.id}>
            <td>
              <span className="mcMono" style={{ fontWeight: 600 }}>
                {employee.codename}
              </span>
            </td>
            <td>{employee.role}</td>
            <td className="mcMono">{t.employeeBuilder.status[employee.status]}</td>
            <td>
              <TagList
                items={employee.skills.map((skill) =>
                  optionLabel(t.employeeBuilder.options.skills, skill),
                )}
                emptyLabel={t.common.empty}
              />
            </td>
            <td>
              <TagList items={employee.tools} emptyLabel={t.common.empty} />
            </td>
            <td>
              <span className="mcMuted" style={{ fontSize: 12 }}>
                {summarizePermissions(employee.permissions, permissionLabels)}
              </span>
            </td>
            <td>
              <TagList
                items={employee.restrictions.map((item) =>
                  optionLabel(t.employeeBuilder.options.restrictions, item),
                )}
                emptyLabel={t.common.empty}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function AgentTable({
  rows,
  showLoad,
  customIds,
  onDuplicate,
}: {
  rows: Agent[]
  showLoad: boolean
  customIds?: Set<string>
  onDuplicate?: (id: string) => void
}) {
  const { t } = useI18n()
  const showActions = Boolean(onDuplicate && customIds && customIds.size > 0)

  return (
    <table className="mcTable">
      <thead>
        <tr>
          <th>{t.labels.agent}</th>
          <th>{t.labels.role}</th>
          <th>{t.labels.squad}</th>
          <th>{t.labels.model}</th>
          <th>{t.labels.status}</th>
          <th>{t.labels.currentTask}</th>
          {showLoad ? <th>{t.labels.load}</th> : <th>{t.labels.lastActivity}</th>}
          {showActions ? <th>{t.employees.actions}</th> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => (
          <tr key={a.id} style={{ opacity: a.lifecycle === 'planned' ? 0.65 : 1 }}>
            <td>
              <span className="mcRowFlex">
                <StatusDot kind={statusDotKind(a.status, a.lifecycle)} />
                <span className="mcMono" style={{ fontWeight: 600 }}>
                  {a.codename}
                </span>
              </span>
            </td>
            <td>{a.role}</td>
            <td className="mcMuted">{a.squad}</td>
            <td className="mcMono mcMuted">{a.model}</td>
            <td className={agentStatusClass(a.lifecycle === 'planned' ? 'offline' : a.status)}>
              {a.lifecycle === 'planned'
                ? t.labels.planned.toLowerCase()
                : t.agentStatus[a.status]}
            </td>
            <td className="mcMono">{a.currentTaskId ?? t.common.empty}</td>
            <td>
              {showLoad ? (
                <div className="mcRowFlex">
                  <div className="mcLoadBar">
                    <div className={loadFillClass(a.loadPct)} style={{ width: `${a.loadPct}%` }} />
                  </div>
                  <span className="mcMono mcMuted">{a.loadPct}%</span>
                </div>
              ) : (
                <span className="mcMuted" style={{ fontSize: 12 }}>
                  {a.lastActivity}
                </span>
              )}
            </td>
            {showActions ? (
              <td>
                {customIds?.has(a.id) ? (
                  <button
                    type="button"
                    className="mcBtn mcBtnSecondary mcBtnSmall"
                    onClick={() => onDuplicate?.(a.id)}
                  >
                    {t.employees.duplicate}
                  </button>
                ) : (
                  <span className="mcMuted">{t.common.empty}</span>
                )}
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function EmployeesPage() {
  const { t } = useI18n()
  const { employees: customEmployees, duplicateEmployee } = useCustomEmployees()

  const customIds = new Set(customEmployees.map((employee) => employee.id))

  const handleDuplicate = (id: string) => {
    const source = customEmployees.find((employee) => employee.id === id)
    if (source) duplicateEmployee(source, t.employees.copyOf)
  }

  const customActive = customEmployees
    .filter((employee) => employee.status === 'active')
    .map(customEmployeeToAgent)
  const customPlanned = customEmployees
    .filter((employee) => employee.status === 'planned')
    .map(customEmployeeToAgent)
  const customDisabled = customEmployees
    .filter((employee) => employee.status === 'disabled')
    .map(customEmployeeToAgent)

  const activeRows = [...activeAgents, ...customActive]
  const plannedRows = [...plannedAgents, ...customPlanned]

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader title={t.pages.employees} description={t.employees.description} />
        <div className="mcPageHeaderActions">
          <Link to="/ops/employees/new" className="mcBtn mcBtnSecondary">
            {t.employees.createFromTemplate}
          </Link>
          <Link to="/ops/employees/new" className="mcBtn mcBtnPrimary">
            {t.employeeBuilder.createButton}
          </Link>
        </div>
      </div>

      <Panel
        title={t.labels.active}
        right={
          <span className="mcMono mcMuted">
            {activeRows.length} {t.employees.agents}
          </span>
        }
      >
        <AgentTable
          rows={activeRows}
          showLoad
          customIds={customIds}
          onDuplicate={handleDuplicate}
        />
      </Panel>

      <div style={{ marginTop: 16 }}>
        <Panel
          title={t.labels.planned}
          right={
            <span className="mcMono mcMuted">
              {plannedRows.length} {t.employees.agents}
            </span>
          }
        >
          <AgentTable
            rows={plannedRows}
            showLoad={false}
            customIds={customIds}
            onDuplicate={handleDuplicate}
          />
        </Panel>
      </div>

      {customDisabled.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <Panel
            title={t.employeeBuilder.status.disabled}
            right={
              <span className="mcMono mcMuted">
                {customDisabled.length} {t.employees.agents}
              </span>
            }
          >
            <AgentTable
              rows={customDisabled}
              showLoad={false}
              customIds={customIds}
              onDuplicate={handleDuplicate}
            />
          </Panel>
        </div>
      ) : null}

      {customEmployees.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <Panel
            title={t.organization.customEmployees}
            right={
              <span className="mcMono mcMuted">
                {customEmployees.length} {t.employees.agents}
              </span>
            }
          >
            <CustomEmployeeDetailTable rows={customEmployees} />
          </Panel>
        </div>
      ) : null}
    </>
  )
}
