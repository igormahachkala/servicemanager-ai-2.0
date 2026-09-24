export type LocationFormValue = {
  pointNumber: string
  name: string
  city: string
  address: string
  isActive: boolean
}

type Props = {
  title: string
  submitLabel: string
  value: LocationFormValue
  submitting?: boolean
  onChange: (patch: Partial<LocationFormValue>) => void
  onSubmit: (event: React.FormEvent) => void
  onCancel?: () => void
}

export function LocationForm({
  title,
  submitLabel,
  value,
  submitting,
  onChange,
  onSubmit,
  onCancel,
}: Props) {
  return (
    <form onSubmit={onSubmit} className="form">
      <h3 style={{ marginBottom: 10 }}>{title}</h3>

      <label>
        Номер точки
        <input
          value={value.pointNumber}
          onChange={(e) => onChange({ pointNumber: e.target.value })}
          placeholder="001"
          disabled={submitting}
        />
      </label>

      <label>
        Название
        <input
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Точка на Ленина"
          disabled={submitting}
        />
      </label>

      <label>
        Город
        <input
          value={value.city}
          onChange={(e) => onChange({ city: e.target.value })}
          placeholder="Екатеринбург"
          disabled={submitting}
        />
      </label>

      <label>
        Адрес
        <input
          value={value.address}
          onChange={(e) => onChange({ address: e.target.value })}
          placeholder="ул. Ленина, 1"
          disabled={submitting}
        />
      </label>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={value.isActive}
          onChange={(e) => onChange({ isActive: e.target.checked })}
          disabled={submitting}
        />
        <span>Локация активна</span>
      </label>

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
