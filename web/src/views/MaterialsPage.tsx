import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import {
  activeMaterials,
  formatMaterialQuantity,
  normalizeDecimalInput,
  validateIssueInput,
  validateMaterialInput,
} from '../lib/materials'

type MaterialForm = { name: string; unit: string; sku: string; category: string }
const EMPTY_FORM: MaterialForm = { name: '', unit: '', sku: '', category: '' }

export function MaterialsPage() {
  const qc = useQueryClient()
  const [create, setCreate] = useState<MaterialForm>(EMPTY_FORM)
  const [editing, setEditing] = useState<(MaterialForm & { id: string }) | null>(null)
  const [receipt, setReceipt] = useState({ materialId: '', quantity: '', comment: '' })
  const [message, setMessage] = useState<string | null>(null)
  const materialsQ = useQuery({ queryKey: ['materials-directory'], queryFn: api.materials })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['materials-directory'] })

  const createM = useMutation({
    mutationFn: api.createMaterial,
    onSuccess: async () => {
      setCreate(EMPTY_FORM)
      setMessage('Материал создан')
      await invalidate()
    },
  })
  const updateM = useMutation({
    mutationFn: ({ id, input }: { id: string; input: api.UpdateMaterialInput }) => api.updateMaterial(id, input),
    onSuccess: async () => {
      setEditing(null)
      setMessage('Материал обновлён')
      await invalidate()
    },
  })
  const receiptM = useMutation({
    mutationFn: api.recordCompanyStockReceipt,
    onSuccess: async (result) => {
      setReceipt({ materialId: '', quantity: '', comment: '' })
      setMessage(`Поступление сохранено. Остаток склада: ${formatMaterialQuantity(result.balance.quantity)}`)
      await invalidate()
    },
  })
  const mutationError = createM.error || updateM.error || receiptM.error

  function materialPayload(form: MaterialForm): api.CreateMaterialInput {
    return {
      name: form.name.trim(),
      unit: form.unit.trim(),
      ...(form.sku.trim() ? { sku: form.sku.trim() } : { sku: null }),
      ...(form.category.trim() ? { category: form.category.trim() } : { category: null }),
    }
  }

  function submitCreate(event: FormEvent) {
    event.preventDefault()
    const input = materialPayload(create)
    const validation = validateMaterialInput(input)
    if (!validation.ok) return setMessage(validation.error)
    setMessage(null)
    createM.mutate(input)
  }

  function submitEdit(event: FormEvent) {
    event.preventDefault()
    if (!editing) return
    const input = materialPayload(editing)
    const validation = validateMaterialInput(input)
    if (!validation.ok) return setMessage(validation.error)
    setMessage(null)
    updateM.mutate({ id: editing.id, input })
  }

  function submitReceipt(event: FormEvent) {
    event.preventDefault()
    const quantity = normalizeDecimalInput(receipt.quantity) ?? receipt.quantity.trim()
    const validation = validateIssueInput({ materialId: receipt.materialId, quantity })
    if (!validation.ok) return setMessage(validation.error)
    setMessage(null)
    receiptM.mutate({
      materialId: receipt.materialId,
      quantity,
      ...(receipt.comment.trim() ? { comment: receipt.comment.trim() } : {}),
    })
  }

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Материалы</h2>
          <div className="muted small">{materialsQ.isFetching ? 'Загрузка…' : `Материалов: ${materialsQ.data?.length || 0}`}</div>
        </div>
        <Link to="/settings"><button className="ghost">← К настройкам</button></Link>
      </div>

      {message ? <div className="muted small" style={{ marginTop: 10 }}>{message}</div> : null}
      {materialsQ.isError ? <div className="alert">{(materialsQ.error as Error).message}</div> : null}
      {mutationError ? <div className="alert">{(mutationError as Error).message}</div> : null}

      <div className="grid2" style={{ marginTop: 14 }}>
        <form className="panel materialsForm" onSubmit={submitCreate}>
          <h3>Новый материал</h3>
          <MaterialFields value={create} onChange={setCreate} disabled={createM.isPending} />
          <button type="submit" disabled={createM.isPending}>Создать</button>
        </form>

        <form className="panel materialsForm" onSubmit={submitReceipt}>
          <h3>Поступление на склад</h3>
          <label>
            Материал
            <select value={receipt.materialId} onChange={(e) => setReceipt((v) => ({ ...v, materialId: e.target.value }))}>
              <option value="">Выберите материал</option>
              {activeMaterials(materialsQ.data || []).map((material) => (
                <option key={material.id} value={material.id}>{material.name} · {material.unit}</option>
              ))}
            </select>
          </label>
          <label>Количество<input inputMode="decimal" value={receipt.quantity} onChange={(e) => setReceipt((v) => ({ ...v, quantity: e.target.value }))} /></label>
          <label>Комментарий<input value={receipt.comment} onChange={(e) => setReceipt((v) => ({ ...v, comment: e.target.value }))} /></label>
          <button type="submit" disabled={receiptM.isPending}>{receiptM.isPending ? 'Сохраняем…' : 'Принять на склад'}</button>
        </form>
      </div>

      {editing ? (
        <form className="panel materialsForm" onSubmit={submitEdit} style={{ marginTop: 14 }}>
          <h3>Редактировать материал</h3>
          <MaterialFields value={editing} onChange={(next) => setEditing({ ...next, id: editing.id })} disabled={updateM.isPending} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={updateM.isPending}>Сохранить</button>
            <button type="button" className="ghost" onClick={() => setEditing(null)}>Отмена</button>
          </div>
        </form>
      ) : null}

      <div className="panel" style={{ marginTop: 14 }}>
        <h3>Справочник</h3>
        {!materialsQ.data?.length ? <div className="muted small">Справочник пуст</div> : null}
        <div className="materialsHistory">
          {materialsQ.data?.map((material) => (
            <div className="materialsHistoryRow" key={material.id}>
              <div>
                <div className="materialsName">{material.name} · {material.unit}</div>
                <div className="muted small">{[material.sku, material.category, material.active ? 'Активен' : 'Неактивен'].filter(Boolean).join(' · ')}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="ghost" onClick={() => setEditing({
                  id: material.id,
                  name: material.name,
                  unit: material.unit,
                  sku: material.sku || '',
                  category: material.category || '',
                })}>Изменить</button>
                <button
                  className="ghost"
                  onClick={() => updateM.mutate({ id: material.id, input: { active: !material.active } })}
                  disabled={updateM.isPending}
                >
                  {material.active ? 'Деактивировать' : 'Активировать'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MaterialFields(props: {
  value: MaterialForm
  onChange: (value: MaterialForm) => void
  disabled?: boolean
}) {
  const { value, onChange, disabled } = props
  const field = (key: keyof MaterialForm) => (event: ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [key]: event.target.value })
  return (
    <>
      <label>Название<input value={value.name} onChange={field('name')} disabled={disabled} /></label>
      <label>Единица измерения<input value={value.unit} onChange={field('unit')} disabled={disabled} /></label>
      <label>SKU<input value={value.sku} onChange={field('sku')} disabled={disabled} /></label>
      <label>Категория<input value={value.category} onChange={field('category')} disabled={disabled} /></label>
    </>
  )
}
