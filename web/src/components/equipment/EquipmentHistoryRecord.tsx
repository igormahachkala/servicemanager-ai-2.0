import type { EquipmentHistoryEntry, EquipmentHistoryPartRef } from '../../lib/api'

function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function partLabel(part: EquipmentHistoryPartRef) {
  return `${part.name}${part.serialNumber ? ` (${part.serialNumber})` : ''} · ${part.quantity}`
}

/** Explicit technical fields only, including when a stale cache has an older DTO. */
export function EquipmentHistoryRecord({ entry, mobile = false }: {
  entry: EquipmentHistoryEntry
  mobile?: boolean
}) {
  const hasParts = entry.partsInstalled.length > 0 || entry.partsRemoved.length > 0
  return (
    <article className={mobile ? 'mobileCard' : 'panel'} style={{ margin: 0 }}>
      <div style={{ fontWeight: 600 }}>Обращение от {dateLabel(entry.createdAt)}</div>
      <dl style={{ display: 'grid', gap: 4, margin: '8px 0 0' }}>
        <dt className="muted small">Предмет обращения</dt>
        <dd style={{ margin: '0 0 4px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{entry.problem || 'Не указан'}</dd>
        <dt className="muted small">Работы с комплектующими</dt>
        <dd style={{ margin: '0 0 4px' }}>
          {entry.partsRemoved.length > 0 ? <div>Снято: {entry.partsRemoved.map(partLabel).join(', ')}</div> : null}
          {entry.partsInstalled.length > 0 ? <div>Установлено: {entry.partsInstalled.map(partLabel).join(', ')}</div> : null}
          {!hasParts ? <span className="muted">Работы с комплектующими не указаны</span> : null}
        </dd>
        <dt className="muted small">Результат работ</dt>
        <dd style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {entry.result || <span className="muted">Результат работ не указан</span>}
        </dd>
      </dl>
      {entry.resultAt ? <div className="muted small" style={{ marginTop: 6 }}>Отметка о результате от {dateLabel(entry.resultAt)}</div> : null}
    </article>
  )
}
