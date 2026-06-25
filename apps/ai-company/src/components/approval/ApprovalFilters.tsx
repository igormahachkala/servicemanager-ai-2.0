import {
  APPROVAL_ACTION_TYPES,
  APPROVAL_PRIORITIES,
  APPROVAL_STATUSES,
} from '../../domain/approval/approval'
import type { ApprovalFilter } from '../../domain/approval/approvalStorage'
import { useI18n } from '../../i18n'

export function ApprovalFilters({
  filter,
  onChange,
}: {
  filter: ApprovalFilter
  onChange: (next: ApprovalFilter) => void
}) {
  const { t } = useI18n()

  return (
    <div className="mcApprovalFilters">
      <label className="mcApprovalFilterField">
        <span className="mcFieldLabel">{t.approvalEngine.filters.status}</span>
        <select
          className="mcInput"
          value={filter.status}
          onChange={(event) =>
            onChange({ ...filter, status: event.target.value as ApprovalFilter['status'] })
          }
        >
          <option value="all">{t.common.all}</option>
          {APPROVAL_STATUSES.map((item) => (
            <option key={item} value={item}>
              {t.approvalEngine.statuses[item]}
            </option>
          ))}
        </select>
      </label>

      <label className="mcApprovalFilterField">
        <span className="mcFieldLabel">{t.approvalEngine.filters.actionType}</span>
        <select
          className="mcInput"
          value={filter.actionType}
          onChange={(event) =>
            onChange({ ...filter, actionType: event.target.value as ApprovalFilter['actionType'] })
          }
        >
          <option value="all">{t.common.all}</option>
          {APPROVAL_ACTION_TYPES.map((item) => (
            <option key={item} value={item}>
              {t.approvalEngine.actionTypes[item]}
            </option>
          ))}
        </select>
      </label>

      <label className="mcApprovalFilterField">
        <span className="mcFieldLabel">{t.approvalEngine.filters.priority}</span>
        <select
          className="mcInput"
          value={filter.priority}
          onChange={(event) =>
            onChange({ ...filter, priority: event.target.value as ApprovalFilter['priority'] })
          }
        >
          <option value="all">{t.common.all}</option>
          {APPROVAL_PRIORITIES.map((item) => (
            <option key={item} value={item}>
              {t.approvalEngine.priorities[item]}
            </option>
          ))}
        </select>
      </label>

      <label className="mcApprovalFilterField">
        <span className="mcFieldLabel">{t.approvalEngine.filters.workspace}</span>
        <select
          className="mcInput"
          value={filter.workspaceId}
          onChange={(event) => onChange({ ...filter, workspaceId: event.target.value })}
        >
          <option value="all">{t.common.all}</option>
          <option value="none">{t.approvalEngine.filters.noWorkspace}</option>
          <option value="ws-sma">ws-sma</option>
        </select>
      </label>
    </div>
  )
}
