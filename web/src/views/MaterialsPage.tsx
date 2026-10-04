import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import { validateMaterialInput } from '../lib/materials'

/**
 * SMA-MATERIALS-V0 — справочник материалов (Desktop/Admin).
 *
 * Построен по образцу SpecializationsPage: тот же CRUD-поток через api-хелперы
 * и те же query-инвалидации. Удаления нет намеренно — использованный материал
 * остаётся в истории движений техника; его только деактивируют.
 *
 * Видимость в меню — существующий management-гейт (Shell). Это не право:
 * авторизацию решает backend, фронт лишь не показывает лишнего.
 */

type EditingState = {
  id: string
  name: string
  unit: string
  sku: string
  category: string
}

export function MaterialsPage() {
  const qc = useQueryClient()

  const [err, setErr] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [sku, setSku] = useState('')
  const [category, setCategory] = useState('')
  const [isActive, setIsActive] = useState(true)

  const [editing, setEditing] = useState<EditingState | null>(null)

  const materialsQ = useQuery({
    queryKey: ['materials'],
    queryFn: () => api.materials(true),
  })

  async function invalidate() {
    await qc.invalidateQueries({ queryKey: ['materials'] })
  }

  const createM = useMutation({
    mutationFn: (payload: api.CreateMaterialInput) => api.createMaterial(payload),
    onSuccess: async (created) => {
      setErr(null)
      setSuccess(`Материал «${created.name}» создан`)
      setName('')
      setUnit('')
      setSku('')
      setCategory('')
      setIsActive(true)
      await invalidate()
    },
    onError: (e: any) => {
      setSuccess(null)
      setErr(e?.message || String(e))
    },
  })

  const updateM = useMutation({
    mutationFn: ({ id, input }: { id: string; input: api.UpdateMaterialInput }) => api.updateMaterial(id, input),
    onSuccess: async (updated) => {
      setErr(null)
      setSuccess(`Материал «${updated.name}» обновлён`)
      setEditing(null)
      await invalidate()
    },
    onError: (e: any) => {
      setSuccess(null)
      setErr(e?.message || String(e))
    },
  })

  const toggleM = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.setMaterialStatus(id, isActive),
    onSuccess: async () => {
      setErr(null)
      setSuccess('Статус материала обновлён')
      await invalidate()
    },
    onError: (e: any) => {
      setSuccess(null)
      setErr(e?.message || String(e))
    },
  })

  const rows = useMemo(() => materialsQ.data || [], [materialsQ.data])
  const busy = createM.isPending || updateM.isPending || toggleM.isPending

  function submitCreate(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setSuccess(null)

    const input: api.CreateMaterialInput = {
      name: name.trim(),
      unit: unit.trim(),
      sku: sku.trim() || null,
      category: category.trim() || null,
      isActive,
    }

    const parsed = validateMaterialInput(input)
    if (!parsed.ok) {
      setErr(parsed.error)
      return
    }

    createM.mutate(input)
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setErr(null)
    setSuccess(null)

    const input: api.UpdateMaterialInput = {
      name: editing.name.trim(),
      unit: editing.unit.trim(),
      sku: editing.sku.trim() || null,
      category: editing.category.trim() || null,
    }

    const parsed = validateMaterialInput({ name: input.name, unit: input.unit })
    if (!parsed.ok) {
      setErr(parsed.error)
      return
    }

    updateM.mutate({ id: editing.id, input })
  }

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Материалы</h2>
          <div className="muted small">
            {materialsQ.isFetching
              ? 'Загрузка…'
              : rows.length
                ? `Всего материалов: ${rows.length}`
                : 'Материалов пока нет'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="ghost" onClick={() => materialsQ.refetch()} disabled={materialsQ.isFetching || busy}>
            Обновить
          </button>
          <Link to="/employees">
            <button className="ghost">Сотрудники</button>
          </Link>
          <Link to="/board">
            <button className="ghost">← Назад к доске</button>
          </Link>
        </div>
      </div>

      <div className="pageHint">
        Справочник материалов компании. Единица измерения используется для остатков техника и истории движений.
      </div>

      {err ? <div className="alert">{err}</div> : null}
      {success ? <div className="panel" style={{ marginBottom: 12 }}>{success}</div> : null}
      {materialsQ.isError ? (
        <div className="alert">{(materialsQ.error as any)?.message || String(materialsQ.error)}</div>
      ) : null}

      <div className="grid2" style={{ gridTemplateColumns: '1fr 1.35fr' }}>
        <div className="panel">
          <h3 style={{ marginBottom: 10 }}>+ Материал</h3>

          <form onSubmit={submitCreate} className="form">
            <label>
              Название *
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Кабель ВВГ 3×2.5" disabled={createM.isPending} />
            </label>

            <label>
              Единица измерения *
              <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="м" disabled={createM.isPending} />
            </label>

            <label>
              SKU
              <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="необязательно" disabled={createM.isPending} />
            </label>

            <label>
              Категория
              <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="необязательно" disabled={createM.isPending} />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} disabled={createM.isPending} />
              <span>Материал активен</span>
            </label>

            <button type="submit" disabled={busy}>
              {createM.isPending ? 'Создаём…' : 'Создать материал'}
            </button>

            <div className="muted small">Неактивные материалы нельзя выдать технику, но они остаются в истории.</div>
          </form>
        </div>

        <div className="panel">
          <h3 style={{ marginBottom: 10 }}>Список материалов</h3>

          {materialsQ.isFetching && !materialsQ.data ? <div className="muted small">Загрузка…</div> : null}
          {!materialsQ.isFetching && rows.length === 0 ? (
            <div className="muted small">Материалов пока нет</div>
          ) : null}

          {rows.length > 0 ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {rows.map((m) =>
                editing && editing.id === m.id ? (
                  <div key={m.id} className="panel" style={{ padding: 12 }}>
                    <form onSubmit={submitEdit} className="form" style={{ gap: 6 }}>
                      <label>
                        Название *
                        <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} disabled={updateM.isPending} />
                      </label>
                      <label>
                        Единица измерения *
                        <input value={editing.unit} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} disabled={updateM.isPending} />
                      </label>
                      <label>
                        SKU
                        <input value={editing.sku} onChange={(e) => setEditing({ ...editing, sku: e.target.value })} disabled={updateM.isPending} />
                      </label>
                      <label>
                        Категория
                        <input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} disabled={updateM.isPending} />
                      </label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="submit" disabled={updateM.isPending}>
                          {updateM.isPending ? 'Сохраняем…' : 'Сохранить'}
                        </button>
                        <button type="button" className="ghost" onClick={() => setEditing(null)} disabled={updateM.isPending}>
                          Отмена
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div key={m.id} className="materialRow" style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, padding: 10 }}>
                    <div className="row" style={{ marginBottom: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700 }}>
                          {m.name} <span className="muted small">· {m.unit}</span>
                        </div>
                        <div className="muted small" style={{ marginTop: 4 }}>
                          SKU: {m.sku || '—'} · Категория: {m.category || '—'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="tag">{m.isActive ? 'Активен' : 'Неактивен'}</span>
                        <button
                          className="ghost"
                          onClick={() =>
                            setEditing({ id: m.id, name: m.name, unit: m.unit, sku: m.sku || '', category: m.category || '' })
                          }
                          disabled={busy}
                        >
                          Редактировать
                        </button>
                        <button className="ghost" onClick={() => toggleM.mutate({ id: m.id, isActive: !m.isActive })} disabled={busy}>
                          {m.isActive ? 'Деактивировать' : 'Активировать'}
                        </button>
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default MaterialsPage
