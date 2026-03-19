import * as api from '../../lib/api'

type Props = {
  specializations: api.SpecializationListItem[]
  selectedIds: string[]
  disabled?: boolean
  onToggle: (specializationId: string) => void
}

export function EmployeeSpecializationsField({
  specializations,
  selectedIds,
  disabled,
  onToggle,
}: Props) {
  if (specializations.length === 0) {
    return <div className="muted small">No active specializations yet.</div>
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {specializations.map((spec) => (
        <label key={spec.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={selectedIds.includes(spec.id)}
            onChange={() => onToggle(spec.id)}
            disabled={disabled}
          />
          <span>{spec.name}</span>
        </label>
      ))}
    </div>
  )
}
