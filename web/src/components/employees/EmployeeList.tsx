import * as api from '../../lib/api'
import { EmployeeCard } from './EmployeeCard'
import { EmployeeForm, type EmployeeFormValue } from './EmployeeForm'
import { type ReactNode } from 'react'

type Props = {
  users: api.UserListItem[]
  currentUserId: string | null
  activeAdminCount: number
  activeSpecializations: api.SpecializationListItem[]
  editingUserId: string | null
  editingValue: EmployeeFormValue
  busy?: boolean
  onBeginEdit: (user: api.UserListItem) => void
  onCancelEdit: () => void
  onEditChange: (patch: Partial<EmployeeFormValue>) => void
  onToggleEditSpecialization: (specializationId: string) => void
  onSubmitEdit: (event: React.FormEvent) => void
  onToggleActive: (user: api.UserListItem) => void
  editExtras?: ReactNode
}

function displayName(user: api.UserListItem) {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return full || user.email
}

function fmt(date?: string) {
  if (!date) return '—'
  return new Date(date).toLocaleString('ru-RU')
}

function pointsWord(count: number) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'точка'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'точки'
  return 'точек'
}

function technicianBindingsSummary(user: api.UserListItem) {
  const bindings = ((user as any).locationBindings || []) as Array<{ locationId?: string }>
  const locationIds = Array.from(new Set(bindings.map((item) => item.locationId).filter(Boolean)))
  if (locationIds.length === 0) return 'Все доступные точки'
  return `Ограничен: ${locationIds.length} ${pointsWord(locationIds.length)}`
}

function isLocationBoundRole(role: api.Role) {
  return (
    role === 'ADMIN' ||
    role === 'MASTER' ||
    role === 'DISPATCHER' ||
    role === 'TECHNICIAN' ||
    role === 'CLIENT' ||
    role === 'TERRITORIAL_MANAGER' ||
    role === 'NETWORK_DIRECTOR'
  )
}

export function EmployeeList({
  users,
  currentUserId,
  activeAdminCount,
  activeSpecializations,
  editingUserId,
  editingValue,
  busy,
  onBeginEdit,
  onCancelEdit,
  onEditChange,
  onToggleEditSpecialization,
  onSubmitEdit,
  onToggleActive,
  editExtras,
}: Props) {
  if (users.length === 0) {
    return <div className="muted">Сотрудников пока нет.</div>
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {users.map((user) => {
        const isInactive = user.isActive === false
        const isSelf = user.id === currentUserId
        const isLastAdmin = user.role === 'ADMIN' && !isInactive && activeAdminCount <= 1
        const editTitle = displayName(user) === user.email ? 'Редактировать ' + user.email : 'Редактировать ' + displayName(user)

        return (
          <EmployeeCard
            key={user.id}
            user={user}
            actions={(
              <>
                <button className="ghost" onClick={() => onBeginEdit(user)} disabled={busy}>Редактировать</button>
                <button
                  className="ghost"
                  onClick={() => onToggleActive(user)}
                  disabled={busy || (!isInactive && (isSelf || isLastAdmin))}
                >
                  {isInactive ? 'Активировать' : 'Деактивировать'}
                </button>
              </>
            )}
          >
            <div className="muted small" style={{ marginBottom: editingUserId === user.id ? 12 : 0 }}>
              Создан: {fmt(user.createdAt)}
              {isSelf && !isInactive ? ' · Свой аккаунт нельзя деактивировать.' : ''}
              {isLastAdmin ? ' · Это последний активный администратор.' : ''}
            </div>
            {isLocationBoundRole(user.role) ? (
              <div className="muted small" style={{ marginBottom: editingUserId === user.id ? 12 : 0 }}>
                Доступные точки: {technicianBindingsSummary(user)}
              </div>
            ) : null}

            {editingUserId === user.id ? (
              <>
                <EmployeeForm
                  title={editTitle}
                  submitLabel="Сохранить"
                  value={editingValue}
                  activeSpecializations={activeSpecializations}
                  submitting={busy}
                  passwordRequired={false}
                  onChange={onEditChange}
                  onToggleSpecialization={onToggleEditSpecialization}
                  onSubmit={onSubmitEdit}
                  onCancel={onCancelEdit}
                />
                {editExtras}
              </>
            ) : null}
          </EmployeeCard>
        )
      })}
    </div>
  )
}
