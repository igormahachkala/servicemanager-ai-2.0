import { Link } from 'react-router-dom'
import { StatusDot } from './ui'
import type { CustomEmployee } from '../data/customEmployees'
import { getModelById } from '../../domain/runtime/runtimeStorage'
import { useRuntimeProfiles } from '../../hooks/useRuntimeProfiles'
import { RuntimeStatusBadge } from '../../components/runtime/RuntimeStatusBadge'
import { EmployeeStatusBadge } from '../../components/presence'
import { usePresence } from '../../hooks/usePresence'
import { useI18n } from '../../i18n'

function statusDotKind(status: CustomEmployee['status']): 'green' | 'amber' | 'red' | 'gray' {
  if (status === 'active') return 'green'
  if (status === 'planned') return 'gray'
  return 'red'
}

export function EmployeeHeader({ employee }: { employee: CustomEmployee }) {
  const { t } = useI18n()
  const { getProfile } = useRuntimeProfiles()
  const { getByEmployeeId } = usePresence()
  const profile = getProfile(employee.id, employee.primaryModel)
  const presence = getByEmployeeId(employee.id)
  const primaryModel = getModelById(profile.primaryModelId)

  return (
    <header className="mcProfileHeader">
      <div className="mcProfileHeaderTop">
        <Link to="/ops/employees" className="mcProfileBack">
          ← {t.employeeProfile.backToEmployees}
        </Link>
        <span className="mcMono mcMuted">{employee.id}</span>
      </div>

      <div className="mcProfileHeaderMain">
        <div className="mcProfileAvatar" aria-hidden>
          {employee.codename.slice(0, 2).toUpperCase()}
        </div>
        <div className="mcProfileHeaderBody">
          <div className="mcProfileHeaderTitleRow">
            <h1 className="mcProfileTitle">{employee.name}</h1>
            <span className="mcProfileCodename mcMono">{employee.codename}</span>
            <span className="mcProfileStatusBadge">
              <StatusDot kind={statusDotKind(employee.status)} />
              {t.employeeBuilder.status[employee.status]}
            </span>
            <RuntimeStatusBadge status={profile.status} compact />
            {presence ? <EmployeeStatusBadge status={presence.status} compact /> : null}
          </div>
          <div className="mcProfileSubtitle">{employee.role}</div>
          <div className="mcProfileMetaRow">
            <span className="mcMono mcMuted">
              {primaryModel?.name ?? profile.primaryModelId}
            </span>
            <span className="mcMuted">·</span>
            <span className="mcMuted">
              {t.employeeProfile.created}{' '}
              {new Date(employee.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="mcProfileHeaderActions">
            <Link
              to={`/ops/chats/${encodeURIComponent(`conv:${employee.id}`)}`}
              className="mcBtn mcBtnPrimary mcBtnSmall"
            >
              {t.conversations.openConversation}
            </Link>
            <Link
              to={`/ops/employees/${employee.id}/memory`}
              className="mcBtn mcBtnSecondary mcBtnSmall"
            >
              {t.memoryEngine.openMemory}
            </Link>
            <Link
              to={`/ops/employees/${employee.id}/runtime`}
              className="mcBtn mcBtnSecondary mcBtnSmall"
            >
              {t.runtimeEngine.openRuntime}
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
