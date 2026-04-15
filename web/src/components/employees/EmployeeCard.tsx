import * as api from '../../lib/api'

type Props = {
  user: api.UserListItem
  actions?: React.ReactNode
  children?: React.ReactNode
}

function roleLabel(role: api.Role) {
  if (role === 'ADMIN') return 'Администратор'
  if (role === 'DISPATCHER') return 'Диспетчер'
  if (role === 'MASTER') return 'Мастер'
  if (role === 'TECHNICIAN') return 'Техник'
  if (role === 'CLIENT') return 'Клиент'
  if (role === 'TERRITORIAL_MANAGER') return 'Территориальный менеджер'
  if (role === 'NETWORK_DIRECTOR') return 'Сетевой директор'
  if (role === 'STAFF') return 'Сотрудник'
  return role
}

function displayName(user: api.UserListItem) {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return full || user.email
}

function initials(user: api.UserListItem) {
  const source = [user.firstName, user.lastName].filter(Boolean)
  if (source.length > 0) {
    return source.map((part) => String(part).trim().charAt(0).toUpperCase()).join('').slice(0, 2)
  }
  return user.email.slice(0, 2).toUpperCase()
}

export function EmployeeCard({ user, actions, children }: Props) {
  const photoUrl = user.avatarUrl ? api.resolveFileUrl(user.avatarUrl) : ''
  const specs = (user.technicianSpecializations || []).map((item) => item.specialization.name)

  return (
    <div className="panel" style={{ marginBottom: 0 }}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: 1 }}>
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={displayName(user)}
              style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.12)' }}
            />
          ) : (
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                fontWeight: 700,
              }}
            >
              {initials(user)}
            </div>
          )}

          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{displayName(user)}</div>
            <div className="muted small" style={{ marginTop: 4 }}>{user.email}</div>
            <div className="muted small" style={{ marginTop: 6 }}>Роль: {roleLabel(user.role)}</div>
            <div className="muted small">Статус: {user.isActive === false ? 'Неактивен' : 'Активен'}</div>
            {user.role === 'TECHNICIAN' ? (
              <div className="muted small" style={{ marginTop: 6 }}>
                Специализации: {specs.length > 0 ? specs.join(', ') : 'не назначены'}
              </div>
            ) : null}
          </div>
        </div>

        {actions ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{actions}</div> : null}
      </div>

      {children ? <div style={{ marginTop: 14 }}>{children}</div> : null}
    </div>
  )
}
