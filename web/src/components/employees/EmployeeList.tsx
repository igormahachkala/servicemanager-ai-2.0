import * as api from '../../lib/api'
import { EmployeeCard } from './EmployeeCard'
import { EmployeeForm, type EmployeeFormValue } from './EmployeeForm'

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
}

function displayName(user: api.UserListItem) {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return full || user.email
}

function fmt(date?: string) {
  if (!date) return '—'
  return new Date(date).toLocaleString('ru-RU')
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

            {editingUserId === user.id ? (
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
            ) : null}
          </EmployeeCard>
        )
      })}
    </div>
  )
}
