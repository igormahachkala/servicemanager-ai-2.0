type Props = {
  roles: string[]
  companyTypes: string[]
  roleFilter: string
  companyTypeFilter: string
  onRoleChange: (value: string) => void
  onCompanyTypeChange: (value: string) => void
}

const COMPANY_TYPE_LABELS: Record<string, string> = {
  CLIENT: 'CLIENT',
  PROVIDER: 'PROVIDER',
  ANY: 'Любой тип (wildcard)',
}

/** Read-only фильтры матрицы прав: по роли и по типу компании. */
export function PermissionFilters({
  roles,
  companyTypes,
  roleFilter,
  companyTypeFilter,
  onRoleChange,
  onCompanyTypeChange,
}: Props) {
  return (
    <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
      <label className="muted small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        Роль
        <select value={roleFilter} onChange={(e) => onRoleChange(e.target.value)} style={{ minWidth: 160 }}>
          <option value="">Все роли</option>
          {roles.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </label>
      <label className="muted small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        Тип компании
        <select value={companyTypeFilter} onChange={(e) => onCompanyTypeChange(e.target.value)} style={{ minWidth: 200 }}>
          <option value="">Все типы компаний</option>
          {companyTypes.map((t) => (
            <option key={t} value={t}>{COMPANY_TYPE_LABELS[t] || t}</option>
          ))}
        </select>
      </label>
    </div>
  )
}
