import { useMemo, useState, type FormEvent } from 'react'

import type { Material, MaterialBalance, MaterialMovement, PurchaseMaterialInput } from '../../lib/materials'
import {
  activeMaterials,
  formatSignedMaterialQuantity,
  formatMaterialQuantity,
  materialName,
  materialUnit,
  movementTypeLabel,
  normalizeDecimalInput,
  validatePurchaseInput,
} from '../../lib/materials'

function formatDateTime(iso: string) {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
}

export function MaterialsBalanceList(props: { balances: MaterialBalance[]; emptyText?: string }) {
  const { balances, emptyText = 'Материалов пока нет' } = props
  if (!balances.length) return <div className="muted small">{emptyText}</div>
  return (
    <div className="materialsList">
      {balances.map((item) => (
        <div className="materialsRow" key={item.id}>
          <div className="materialsName">{materialName(item.material)}</div>
          <div className="materialsQty">{formatMaterialQuantity(item.quantity, materialUnit(item.material))}</div>
        </div>
      ))}
    </div>
  )
}

export function MaterialMovementsList(props: { movements: MaterialMovement[]; emptyText?: string }) {
  const { movements, emptyText = 'Движений пока нет' } = props
  if (!movements.length) return <div className="muted small">{emptyText}</div>
  return (
    <div className="materialsHistory">
      {movements.map((movement) => (
        <div className="materialsHistoryRow" key={movement.id}>
          <div>
            <div className="materialsName">{materialName(movement.material)}</div>
            <div className="muted small">
              {movementTypeLabel(movement.type)}
              {movement.ticket ? ` · заявка #${movement.ticket.ticketNumber}` : ''}
            </div>
            {movement.comment ? <div className="muted small">{movement.comment}</div> : null}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="materialsQty">
              {formatSignedMaterialQuantity(movement)}
            </div>
            <div className="muted small">{formatDateTime(movement.createdAt)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function SelfPurchaseForm(props: {
  materials: Material[]
  submitting?: boolean
  onSubmit?: (input: PurchaseMaterialInput) => void | Promise<void>
}) {
  const { materials, submitting = false, onSubmit } = props
  const options = useMemo(
    () => activeMaterials(materials).sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [materials],
  )
  const [materialId, setMaterialId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const normalizedQuantity = normalizeDecimalInput(quantity) ?? quantity.trim()
    const normalizedAmount = totalAmount.trim() ? normalizeDecimalInput(totalAmount) ?? totalAmount.trim() : undefined
    const input: PurchaseMaterialInput = {
      materialId,
      quantity: normalizedQuantity,
      ...(normalizedAmount ? { totalAmount: normalizedAmount } : {}),
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    }
    const validation = validatePurchaseInput(input)
    if (!validation.ok) {
      setError(validation.error)
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
            <option key={item.id} value={item.id}>{item.name} · {item.unit}</option>
          ))}
        </select>
      </label>
      <label>
        Количество
        <input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" disabled={submitting} />
      </label>
      <label>
        Общая стоимость
        <input inputMode="decimal" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="Необязательно" disabled={submitting} />
      </label>
      <label>
        Комментарий
        <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Необязательно" disabled={submitting} />
      </label>
      <button type="submit" disabled={submitting}>{submitting ? 'Сохраняем…' : '+ Купил материал'}</button>
    </form>
  )
}
