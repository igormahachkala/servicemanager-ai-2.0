import * as api from '../../lib/api'
import { EmployeeSpecializationsField } from './EmployeeSpecializationsField'

export type EmployeeFormValue = {
  firstName: string
  lastName: string
  avatarUrl: string
  email: string
  password: string
  role: api.Role
  isActive: boolean
  specializationIds: string[]
  locationIds: string[]
}

type Props = {
  title: string
  submitLabel: string
  value: EmployeeFormValue
  activeSpecializations: api.SpecializationListItem[]
  activeLocations: api.LocationListItem[]
  submitting?: boolean
  passwordRequired?: boolean
  allowedRoles?: api.Role[]
  onChange: (patch: Partial<EmployeeFormValue>) => void
  onToggleSpecialization: (specializationId: string) => void
  onToggleLocation: (locationId: string) => void
  onSubmit: (event: React.FormEvent) => void
  onCancel?: () => void
}

function roleOptions(): api.Role[] {
  return [
    'ADMIN',
    'DISPATCHER',
    'MASTER',
    'TECHNICIAN',
    'CLIENT',
    'TERRITORIAL_MANAGER',
    'NETWORK_DIRECTOR',
    'STAFF',
  ]
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

function roleNeedsLocationBinding(role: api.Role) {
  return role === 'CLIENT' || role === 'NETWORK_DIRECTOR' || role === 'TERRITORIAL_MANAGER'
}

function roleSingleLocationBinding(role: api.Role) {
  return role === 'CLIENT' || role === 'NETWORK_DIRECTOR'
}

export function EmployeeForm({
  title,
  submitLabel,
  value,
  activeSpecializations,
  activeLocations,
  submitting,
  passwordRequired,
  allowedRoles,
  onChange,
  onToggleSpecialization,
  onToggleLocation,
  onSubmit,
  onCancel,
}: Props) {
  const needsLocationBinding = roleNeedsLocationBinding(value.role)
  const singleLocation = roleSingleLocationBinding(value.role)

  return (
    <form onSubmit={onSubmit} className="form">
      <h3 style={{ marginBottom: 10 }}>{title}</h3>

      <div className="grid2">
        <label>
          Имя
          <input
            value={value.firstName}
            onChange={(e) => onChange({ firstName: e.target.value })}
            placeholder="Иван"
            disabled={submitting}
          />
        </label>

        <label>
          Фамилия
          <input
            value={value.lastName}
            onChange={(e) => onChange({ lastName: e.target.value })}
            placeholder="Петров"
            disabled={submitting}
          />
        </label>
      </div>

      <label>
        Фото профиля (URL)
        <input
          value={value.avatarUrl}
          onChange={(e) => onChange({ avatarUrl: e.target.value })}
          placeholder="https://..."
          disabled={submitting}
        />
      </label>

      <label>
        Email
        <input
          value={value.email}
          onChange={(e) => onChange({ email: e.target.value })}
          placeholder="employee@company.com"
          disabled={submitting}
        />
      </label>

      <label>
        {passwordRequired ? 'Пароль' : 'Новый пароль'}
        <input
          type="password"
          value={value.password}
          onChange={(e) => onChange({ password: e.target.value })}
          placeholder={passwordRequired ? 'Минимум 8 символов' : 'Оставьте пустым, чтобы не менять'}
          disabled={submitting}
        />
      </label>

      <label>
        Роль
        <select
          value={value.role}
          onChange={(e) => onChange({ role: e.target.value as api.Role })}
          disabled={submitting}
        >
          {(allowedRoles && allowedRoles.length ? allowedRoles : roleOptions()).map((role) => (
            <option key={role} value={role}>{roleLabel(role)}</option>
          ))}
        </select>
      </label>

      {!passwordRequired ? (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={value.isActive}
            onChange={(e) => onChange({ isActive: e.target.checked })}
            disabled={submitting}
          />
          <span>Аккаунт активен</span>
        </label>
      ) : null}

      {value.role === 'TECHNICIAN' ? (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Специализации</div>
          <EmployeeSpecializationsField
            specializations={activeSpecializations}
            selectedIds={value.specializationIds}
            disabled={submitting}
            onToggle={onToggleSpecialization}
          />
        </div>
      ) : null}

      {needsLocationBinding ? (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            Привязка к точкам {singleLocation ? '(ровно 1 точка)' : '(1+ точек)'}
          </div>
          <div style={{ display: 'grid', gap: 8, maxHeight: 180, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
            {activeLocations.length === 0 ? (
              <div className="muted small">Нет доступных точек в вашем контуре.</div>
            ) : activeLocations.map((location) => (
              <label key={location.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={value.locationIds.includes(location.id)}
                  disabled={submitting}
                  onChange={() => onToggleLocation(location.id)}
                />
                <span className="small">
                  {[location.name, location.city, location.address].filter(Boolean).join(' · ')}
                </span>
              </label>
            ))}
          </div>
          <div className="muted small" style={{ marginTop: 6 }}>
            Выбрано: {value.locationIds.length}
          </div>
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 8 }}>
        <button disabled={submitting}>{submitting ? 'Сохраняем...' : submitLabel}</button>
        {onCancel ? (
          <button type="button" className="ghost" onClick={onCancel} disabled={submitting}>
            Отмена
          </button>
        ) : null}
      </div>
    </form>
  )
}
