import { useMemo, useState, type FormEvent } from 'react'
import type {
  CreateMaterialInput,
  ManagerIssueMaterialInput,
  MaterialDirectoryItem,
  MaterialMovement,
  SelfPurchaseInput,
  TechnicianMaterialBalance,
  TicketMaterialUsage,
  TicketMaterialUsageInput,
} from '../../lib/materials'
import {
  activeMaterials,
  findMaterialBalance,
  formatMaterialQuantity,
  materialBalanceLabel,
  movementTypeLabel,
  normalizeMaterialText,
  validateCreateMaterialInput,
  validateManagerIssueMaterialInput,
  validateSelfPurchaseInput,
  validateTicketMaterialUsageInput,
} from '../../lib/materials'

function formatDateTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function materialOptions(materials: MaterialDirectoryItem[]) {
  return activeMaterials(materials).sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}

function numberValue(value: string): number {
  const normalized = value.replace(',', '.').trim()
  return normalized ? Number(normalized) : 0
}

export function MaterialsBalanceList(props: {
  balances: TechnicianMaterialBalance[]
  emptyText?: string
}) {
  const { balances, emptyText = 'Материалов пока нет' } = props
  if (!balances.length) {
    return <div className="muted small">{emptyText}</div>
  }
  return (
    <div className="materialsList">
      {balances.map((item) => (
        <div className="materialsRow" key={item.materialId}>
          <div className="materialsName">{item.materialName}</div>
          <div className="materialsQty">{materialBalanceLabel(item)}</div>
        </div>
      ))}
    </div>
  )
}

export function MaterialMovementsList(props: {
  movements: MaterialMovement[]
  emptyText?: string
}) {
  const { movements, emptyText = 'Движений пока нет' } = props
  if (!movements.length) return <div className="muted small">{emptyText}</div>
  return (
    <div className="materialsHistory">
      {movements.map((movement) => (
        <div className="materialsHistoryRow" key={movement.id}>
          <div>
            <div className="materialsName">{movement.materialName}</div>
            <div className="muted small">
              {movementTypeLabel(movement.type)}
              {movement.ticketNumber ? ` · заявка #${movement.ticketNumber}` : ''}
              {movement.actorName ? ` · ${movement.actorName}` : ''}
            </div>
            {movement.comment ? <div className="muted small">{movement.comment}</div> : null}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="materialsQty">{formatMaterialQuantity(movement.quantity, movement.unit)}</div>
            <div className="muted small">{formatDateTime(movement.createdAt)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function SelfPurchaseForm(props: {
  materials: MaterialDirectoryItem[]
  submitting?: boolean
  receiptAttachmentAvailable?: boolean
  onSubmit?: (input: SelfPurchaseInput) => void | Promise<void>
}) {
  const { materials, submitting = false, receiptAttachmentAvailable = false, onSubmit } = props
  const options = useMemo(() => materialOptions(materials), [materials])
  const [materialId, setMaterialId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [cost, setCost] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const input: SelfPurchaseInput = {
      materialId,
      quantity: numberValue(quantity),
      cost: cost.trim() ? numberValue(cost) : null,
      comment: normalizeMaterialText(comment) || null,
    }
    const validation = validateSelfPurchaseInput(input)
    if (validation) {
      setError(validation)
      return
    }
    setError(null)
    void onSubmit?.(input)
  }

  return (
    <form className="materialsForm" onSubmit={submit}>
      {error ? <div className="alert">{error}</div> : null}
      <label>
        Материал
        <select value={materialId} onChange={(e) => setMaterialId(e.target.value)} disabled={submitting}>
          <option value="">Выберите материал</option>
          {options.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {item.unit}
            </option>
          ))}
        </select>
      </label>
      <label>
        Количество
        <input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" disabled={submitting} />
      </label>
      <label>
        Стоимость
        <input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Необязательно" disabled={submitting} />
      </label>
      <label>
        Фото чека
        <input type="file" accept="image/*,.pdf" disabled={!receiptAttachmentAvailable || submitting} />
        {!receiptAttachmentAvailable ? (
          <span className="fieldHint">Подключается через существующую attachment-архитектуру после backend-контракта.</span>
        ) : null}
      </label>
      <label>
        Комментарий
        <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Необязательно" disabled={submitting} />
      </label>
      <button type="submit" disabled={submitting}>
        {submitting ? 'Сохраняем…' : '+ Купил материал'}
      </button>
    </form>
  )
}

export function TicketMaterialsPanel(props: {
  usedMaterials: TicketMaterialUsage[]
  balances: TechnicianMaterialBalance[]
  canAdd?: boolean
  submitting?: boolean
  error?: string | null
  onAdd?: (input: TicketMaterialUsageInput) => void | Promise<void>
}) {
  const { usedMaterials, balances, canAdd = true, submitting = false, error = null, onAdd } = props
  const [materialId, setMaterialId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [comment, setComment] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const selectedBalance = findMaterialBalance(balances, materialId)

  function submit(e: FormEvent) {
    e.preventDefault()
    const input: TicketMaterialUsageInput = {
      materialId,
      quantity: numberValue(quantity),
      comment: normalizeMaterialText(comment) || null,
    }
    const validation = validateTicketMaterialUsageInput(input, balances)
    if (validation) {
      setLocalError(validation)
      return
    }
    setLocalError(null)
    void onAdd?.(input)
  }

  return (
    <div className="materialsPanel">
      <div className="materialsPanelHeader">
        <h3>Материалы</h3>
        <span className="muted small">{usedMaterials.length ? `Позиций: ${usedMaterials.length}` : 'Пока не списывались'}</span>
      </div>
      {usedMaterials.length ? (
        <div className="materialsHistory">
          {usedMaterials.map((item) => (
            <div className="materialsHistoryRow" key={item.id}>
              <div>
                <div className="materialsName">{item.materialName}</div>
                {item.comment ? <div className="muted small">{item.comment}</div> : null}
                {item.technicianName ? <div className="muted small">{item.technicianName}</div> : null}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="materialsQty">{formatMaterialQuantity(item.quantity, item.unit)}</div>
                <div className="muted small">{formatDateTime(item.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="muted small">Использованные материалы пока не добавлены</div>
      )}
      {canAdd ? (
        <form className="materialsForm" onSubmit={submit}>
          {(localError || error) ? <div className="alert">{localError || error}</div> : null}
          <label>
            Материал
            <select value={materialId} onChange={(e) => setMaterialId(e.target.value)} disabled={submitting}>
              <option value="">Выберите материал из текущих остатков</option>
              {balances.map((item) => (
                <option key={item.materialId} value={item.materialId}>
                  {item.materialName} · доступно {materialBalanceLabel(item)}
                </option>
              ))}
            </select>
          </label>
          {selectedBalance ? (
            <div className="fieldHint">Доступный остаток: {materialBalanceLabel(selectedBalance)}</div>
          ) : null}
          <label>
            Количество
            <input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" disabled={submitting} />
          </label>
          <label>
            Комментарий
            <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Необязательно" disabled={submitting} />
          </label>
          <button type="submit" disabled={submitting || balances.length === 0}>
            {submitting ? 'Добавляем…' : '+ Добавить материал'}
          </button>
        </form>
      ) : null}
    </div>
  )
}

export function ManagerIssueMaterialForm(props: {
  materials: MaterialDirectoryItem[]
  submitting?: boolean
  onSubmit?: (input: ManagerIssueMaterialInput) => void | Promise<void>
}) {
  const { materials, submitting = false, onSubmit } = props
  const options = useMemo(() => materialOptions(materials), [materials])
  const [materialId, setMaterialId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const input: ManagerIssueMaterialInput = {
      materialId,
      quantity: numberValue(quantity),
      comment: normalizeMaterialText(comment) || null,
    }
    const validation = validateManagerIssueMaterialInput(input)
    if (validation) {
      setError(validation)
      return
    }
    setError(null)
    void onSubmit?.(input)
  }

  return (
    <form className="materialsForm" onSubmit={submit}>
      {error ? <div className="alert">{error}</div> : null}
      <label>
        Материал
        <select value={materialId} onChange={(e) => setMaterialId(e.target.value)} disabled={submitting}>
          <option value="">Выберите материал</option>
          {options.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {item.unit}
            </option>
          ))}
        </select>
      </label>
      <label>
        Количество
        <input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" disabled={submitting} />
      </label>
      <label>
        Комментарий
        <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Необязательно" disabled={submitting} />
      </label>
      <button type="submit" disabled={submitting}>
        {submitting ? 'Выдаём…' : '+ Выдать материал'}
      </button>
    </form>
  )
}

export function EmployeeTechnicianMaterialsSection(props: {
  balances: TechnicianMaterialBalance[]
  movements: MaterialMovement[]
  materials: MaterialDirectoryItem[]
  loading?: boolean
  submitting?: boolean
  onIssue?: (input: ManagerIssueMaterialInput) => void | Promise<void>
}) {
  const { balances, movements, materials, loading = false, submitting = false, onIssue } = props
  return (
    <div className="panel uiCard materialsEmployeeSection" style={{ marginTop: 12 }}>
      <div className="materialsPanelHeader">
        <h3>Материалы</h3>
        {loading ? <span className="muted small">Загрузка…</span> : null}
      </div>
      <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <h4 style={{ margin: '0 0 8px' }}>Текущие остатки</h4>
          <MaterialsBalanceList balances={balances} />
        </div>
        <div>
          <h4 style={{ margin: '0 0 8px' }}>История движений</h4>
          <MaterialMovementsList movements={movements} />
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <h4 style={{ margin: '0 0 8px' }}>Выдать материал</h4>
        <ManagerIssueMaterialForm materials={materials} submitting={submitting} onSubmit={onIssue} />
      </div>
    </div>
  )
}

export function MaterialDictionaryPanel(props: {
  materials: MaterialDirectoryItem[]
  loading?: boolean
  submitting?: boolean
  onCreate?: (input: CreateMaterialInput) => void | Promise<void>
  onToggleActive?: (materialId: string, active: boolean) => void | Promise<void>
}) {
  const { materials, loading = false, submitting = false, onCreate, onToggleActive } = props
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [sku, setSku] = useState('')
  const [category, setCategory] = useState('')
  const [active, setActive] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const input: CreateMaterialInput = {
      name: normalizeMaterialText(name),
      unit: normalizeMaterialText(unit),
      sku: normalizeMaterialText(sku) || null,
      category: normalizeMaterialText(category) || null,
      active,
    }
    const validation = validateCreateMaterialInput(input)
    if (validation) {
      setError(validation)
      return
    }
    setError(null)
    void onCreate?.(input)
  }

  return (
    <div className="grid2" style={{ gridTemplateColumns: '1fr 1.5fr' }}>
      <div className="panel">
        <h3 style={{ marginBottom: 10 }}>Создать материал</h3>
        <form className="materialsForm" onSubmit={submit}>
          {error ? <div className="alert">{error}</div> : null}
          <label>
            Название
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Кабель ВВГ 3×2.5" disabled={submitting} />
          </label>
          <label>
            Единица измерения
            <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="м, шт, кг" disabled={submitting} />
          </label>
          <label>
            SKU
            <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Необязательно" disabled={submitting} />
          </label>
          <label>
            Категория
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Необязательно" disabled={submitting} />
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={submitting} />
            <span>Материал активен</span>
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Создаём…' : 'Создать материал'}
          </button>
        </form>
      </div>
      <div className="panel">
        <div className="materialsPanelHeader">
          <h3 style={{ marginBottom: 10 }}>Материалы</h3>
          {loading ? <span className="muted small">Загрузка…</span> : null}
        </div>
        {!loading && materials.length === 0 ? <div className="muted small">Справочник материалов пуст</div> : null}
        <div className="materialsHistory">
          {materials.map((item) => (
            <div className="materialsHistoryRow" key={item.id}>
              <div>
                <div className="materialsName">{item.name}</div>
                <div className="muted small">
                  {item.unit}
                  {item.sku ? ` · SKU ${item.sku}` : ''}
                  {item.category ? ` · ${item.category}` : ''}
                </div>
              </div>
              <button type="button" className="ghost" disabled={submitting} onClick={() => onToggleActive?.(item.id, item.active === false)}>
                {item.active === false ? 'Активировать' : 'Деактивировать'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
