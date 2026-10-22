import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import {
  AUDIENCE_ROLE_OPTIONS,
  EMPTY_FORM,
  STATUS_LABEL,
  audienceLabel,
  canManageProductUpdates,
  formErrors,
  formFromUpdate,
  formatUpdateDate,
  inputFromForm,
  managedScopeLabel,
  missingForPublish,
  type ProductUpdateForm,
} from '../lib/productUpdates'
import { ProductUpdateCard } from '../ui/ProductUpdateCard'

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

type Tab = 'feed' | 'manage'

const rowStyle = {
  display: 'block',
  width: '100%',
  height: 'auto',
  whiteSpace: 'normal' as const,
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 12,
  background: '#fff',
  cursor: 'pointer',
  textAlign: 'left' as const,
}

/** «Что нового»: история опубликованных обновлений и карточка выбранного. */
function Feed() {
  const updatesQ = useQuery({ queryKey: ['product-updates'], queryFn: api.productUpdates })
  const rows = useMemo(() => updatesQ.data ?? [], [updatesQ.data])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null

  if (updatesQ.isError) return <div className="alert">{formatError(updatesQ.error)}</div>
  if (updatesQ.isLoading) return <div className="muted small">Загрузка…</div>
  if (!rows.length) return <div className="panel muted">Опубликованных обновлений пока нет.</div>

  return (
    <div className="grid2" style={{ gridTemplateColumns: 'minmax(220px, 1fr) 2fr', alignItems: 'start' }}>
      <div className="panel" style={{ display: 'grid', gap: 8 }}>
        <h3 style={{ marginBottom: 4 }}>История</h3>
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            className="ghost"
            style={{ ...rowStyle, borderColor: selected?.id === row.id ? '#93c5fd' : '#e5e7eb' }}
            onClick={() => setSelectedId(row.id)}
            aria-pressed={selected?.id === row.id}
          >
            <div style={{ fontWeight: 700 }}>{row.title}</div>
            <div className="muted small" style={{ marginTop: 2 }}>{formatUpdateDate(row.publishedAt)}</div>
            {row.summary ? <div className="small" style={{ marginTop: 4 }}>{row.summary}</div> : null}
          </button>
        ))}
      </div>
      <div className="panel">{selected ? <ProductUpdateCard update={selected} /> : null}</div>
    </div>
  )
}

/** Редактор и публикация карточек области администратора. */
function Manage({ role }: { role?: string | null }) {
  const qc = useQueryClient()
  const managedQ = useQuery({ queryKey: ['product-updates', 'manage'], queryFn: api.managedProductUpdates })
  const rows = useMemo(() => managedQ.data ?? [], [managedQ.data])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProductUpdateForm>(EMPTY_FORM)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const current = rows.find((r) => r.id === editingId) ?? null
  const isDraft = !current || current.status === 'DRAFT'
  const errors = formErrors(form)
  const missing = missingForPublish(form)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['product-updates'] })

  function open(update: api.ProductUpdate | null) {
    setEditingId(update?.id ?? null)
    setForm(update ? formFromUpdate(update) : EMPTY_FORM)
    setConfirmOpen(false)
    setConfirmChecked(false)
    setMessage(null)
  }

  const saveM = useMutation({
    mutationFn: () => (editingId ? api.updateProductUpdate(editingId, inputFromForm(form)) : api.createProductUpdate(inputFromForm(form))),
    onSuccess: async (saved) => {
      setEditingId(saved.id)
      setMessage('Черновик сохранён')
      await invalidate()
    },
  })

  const publishM = useMutation({
    mutationFn: async () => {
      // Публикуется сохранённый текст: сначала сохраняем черновик, затем публикуем.
      const saved = editingId ? await api.updateProductUpdate(editingId, inputFromForm(form)) : await api.createProductUpdate(inputFromForm(form))
      return api.publishProductUpdate(saved.id)
    },
    onSuccess: async (published) => {
      setEditingId(published.id)
      setConfirmOpen(false)
      setConfirmChecked(false)
      setMessage('Обновление опубликовано')
      await invalidate()
    },
  })

  const unpublishM = useMutation({
    mutationFn: (id: string) => api.unpublishProductUpdate(id),
    onSuccess: async (draft) => {
      setForm(formFromUpdate(draft))
      setMessage('Снято с публикации — карточка снова черновик')
      await invalidate()
    },
  })

  const deleteM = useMutation({
    mutationFn: (id: string) => api.deleteProductUpdateDraft(id),
    onSuccess: async () => {
      open(null)
      setMessage('Черновик удалён')
      await invalidate()
    },
  })

  const busy = saveM.isPending || publishM.isPending || unpublishM.isPending || deleteM.isPending
  const mutationError = saveM.error || publishM.error || unpublishM.error || deleteM.error

  function submit(event: FormEvent) {
    event.preventDefault()
    if (errors.length) return
    saveM.mutate()
  }

  const set = <K extends keyof ProductUpdateForm>(key: K, value: ProductUpdateForm[K]) => setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <div>
      <div className="pageHint">{managedScopeLabel(role)}. Карточка видна читателям только после публикации с подтверждением.</div>
      {message ? <div className="panel" style={{ marginBottom: 12 }}>{message}</div> : null}
      {managedQ.isError ? <div className="alert">{formatError(managedQ.error)}</div> : null}
      {mutationError ? <div className="alert">{formatError(mutationError)}</div> : null}

      <div className="grid2" style={{ gridTemplateColumns: 'minmax(220px, 1fr) 2fr', alignItems: 'start' }}>
        <div className="panel" style={{ display: 'grid', gap: 8 }}>
          <div className="row">
            <h3 style={{ margin: 0 }}>Карточки</h3>
            <button type="button" onClick={() => open(null)} disabled={busy}>Новая карточка</button>
          </div>
          {managedQ.isLoading ? <div className="muted small">Загрузка…</div> : null}
          {!managedQ.isLoading && !rows.length ? <div className="muted small">Карточек пока нет.</div> : null}
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              className="ghost"
              style={{ ...rowStyle, borderColor: editingId === row.id ? '#93c5fd' : '#e5e7eb' }}
              onClick={() => open(row)}
              disabled={busy}
            >
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, minWidth: 0 }}>{row.title || 'Без заголовка'}</span>
                <span className="tag">{STATUS_LABEL[row.status]}</span>
              </div>
              <div className="muted small" style={{ marginTop: 2 }}>
                {row.status === 'PUBLISHED' ? formatUpdateDate(row.publishedAt) : 'Черновик'} · {audienceLabel(row.audienceRoles)}
                {row.source === 'RELEASE' ? ' · из релиза' : ''}
              </div>
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <form className="panel form" onSubmit={submit}>
            <h3 style={{ marginBottom: 10 }}>{current ? (isDraft ? 'Черновик' : 'Опубликованная карточка') : 'Новая карточка'}</h3>
            {!isDraft ? (
              <div className="muted small" style={{ marginBottom: 8 }}>
                Опубликованную карточку не редактируют: снимите её с публикации, поправьте и опубликуйте заново.
              </div>
            ) : null}
            <fieldset disabled={!isDraft || busy} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 10 }}>
              <label>
                Заголовок *
                <input value={form.title} maxLength={200} onChange={(e) => set('title', e.target.value)} placeholder="Планирование обходов по расписанию" />
              </label>
              <label>
                Краткое описание *
                <textarea value={form.summary} maxLength={1000} rows={2} onChange={(e) => set('summary', e.target.value)} />
              </label>
              <label>
                Что изменилось *
                <textarea value={form.changes} maxLength={10000} rows={4} onChange={(e) => set('changes', e.target.value)} />
              </label>
              <label>
                Как пользоваться *
                <textarea value={form.howToUse} maxLength={10000} rows={4} onChange={(e) => set('howToUse', e.target.value)} />
              </label>
              <label>
                Ссылка на функцию
                <input value={form.featurePath} maxLength={300} onChange={(e) => set('featurePath', e.target.value)} placeholder="/inspection/schedules" />
              </label>

              <div>
                <div className="fieldLabel">Изображения и пояснения</div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {form.media.map((item, index) => (
                    <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr auto', gap: 6 }}>
                      <input
                        value={item.url}
                        placeholder="https://… или /uploads/…"
                        aria-label={`Адрес изображения ${index + 1}`}
                        onChange={(e) => set('media', form.media.map((m, i) => (i === index ? { ...m, url: e.target.value } : m)))}
                      />
                      <input
                        value={item.caption}
                        maxLength={300}
                        placeholder="Пояснение"
                        aria-label={`Пояснение к изображению ${index + 1}`}
                        onChange={(e) => set('media', form.media.map((m, i) => (i === index ? { ...m, caption: e.target.value } : m)))}
                      />
                      <button type="button" className="ghost" onClick={() => set('media', form.media.filter((_, i) => i !== index))}>
                        Убрать
                      </button>
                    </div>
                  ))}
                </div>
                {form.media.length < 10 ? (
                  <button type="button" className="ghost" style={{ marginTop: 6 }} onClick={() => set('media', [...form.media, { url: '', caption: '' }])}>
                    + Изображение
                  </button>
                ) : null}
              </div>

              <div>
                <div className="fieldLabel">Кому показывать (ничего не выбрано — всем)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
                  {AUDIENCE_ROLE_OPTIONS.map(([roleCode, label]) => (
                    <label key={roleCode} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, padding: 0 }}>
                      <input
                        type="checkbox"
                        style={{ height: 'auto' }}
                        checked={form.audienceRoles.includes(roleCode)}
                        onChange={(e) =>
                          set('audienceRoles', e.target.checked ? [...form.audienceRoles, roleCode] : form.audienceRoles.filter((r) => r !== roleCode))
                        }
                      />
                      <span className="small">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </fieldset>

            {errors.length ? (
              <ul className="alert" style={{ margin: '10px 0 0', paddingLeft: 20 }}>
                {errors.map((error) => <li key={error}>{error}</li>)}
              </ul>
            ) : null}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              {isDraft ? (
                <>
                  <button type="submit" disabled={busy || errors.length > 0}>{saveM.isPending ? 'Сохраняем…' : 'Сохранить черновик'}</button>
                  <button type="button" className="ghost" disabled={busy || errors.length > 0} onClick={() => setConfirmOpen(true)}>
                    Опубликовать…
                  </button>
                  {current ? (
                    <button type="button" className="ghost" disabled={busy} onClick={() => deleteM.mutate(current.id)}>
                      Удалить черновик
                    </button>
                  ) : null}
                </>
              ) : current ? (
                <button type="button" className="ghost" disabled={busy} onClick={() => unpublishM.mutate(current.id)}>
                  Снять с публикации
                </button>
              ) : null}
            </div>

            {/* Публикация — только после явного подтверждения администратором. */}
            {confirmOpen && isDraft ? (
              <div className="panel" style={{ marginTop: 12, borderColor: '#f59e0b' }} role="alertdialog" aria-label="Подтверждение публикации">
                <div style={{ fontWeight: 700 }}>Публикация обновления</div>
                <div className="small" style={{ marginTop: 4 }}>
                  Карточку увидят: {audienceLabel(form.audienceRoles).toLowerCase()} — {role === 'PLATFORM_ADMIN' ? 'во всех компаниях' : 'в вашей компании'}.
                </div>
                {missing.length ? (
                  <div className="alert" style={{ marginTop: 8 }}>Заполните разделы: {missing.join(', ')}.</div>
                ) : (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <input type="checkbox"
                        style={{ height: 'auto' }} checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} />
                    <span>Я проверил карточку и подтверждаю публикацию</span>
                  </label>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button type="button" disabled={busy || !confirmChecked || missing.length > 0} onClick={() => publishM.mutate()}>
                    {publishM.isPending ? 'Публикуем…' : 'Опубликовать'}
                  </button>
                  <button type="button" className="ghost" disabled={busy} onClick={() => setConfirmOpen(false)}>
                    Отмена
                  </button>
                </div>
              </div>
            ) : null}
          </form>

          <div className="panel">
            <div className="muted small" style={{ marginBottom: 8 }}>Предпросмотр</div>
            <ProductUpdateCard
              update={{
                title: form.title,
                summary: form.summary,
                changes: form.changes,
                howToUse: form.howToUse,
                featurePath: form.featurePath || null,
                media: form.media,
                audienceRoles: form.audienceRoles,
                publishedAt: current?.publishedAt ?? null,
              }}
              showAudience
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function UpdatesCenterPage() {
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const canManage = canManageProductUpdates(meQ.data)
  const [tab, setTab] = useState<Tab>('feed')
  const activeTab: Tab = canManage ? tab : 'feed'

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Что нового</h2>
          <div className="muted small">Обновления сервиса: что изменилось и как этим пользоваться</div>
        </div>
        {canManage ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className={activeTab === 'feed' ? undefined : 'ghost'} onClick={() => setTab('feed')} aria-pressed={activeTab === 'feed'}>
              Лента
            </button>
            <button type="button" className={activeTab === 'manage' ? undefined : 'ghost'} onClick={() => setTab('manage')} aria-pressed={activeTab === 'manage'}>
              Управление
            </button>
          </div>
        ) : null}
      </div>
      {activeTab === 'manage' ? <Manage role={meQ.data?.role} /> : <Feed />}
    </div>
  )
}
