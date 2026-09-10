import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../../lib/api'

/**
 * SMA-EQUIPMENT-HISTORY-PARTS-110B + SMA-EQUIPMENT-PARTS-POLISH-110C.
 *
 * Вкладка «Компоненты»: что стоит сейчас и что снимали раньше.
 *
 * Замена не переписывает строку. Старая закрывается датой снятия и заявкой,
 * новая заводится отдельной записью — обе остаются видимыми. Поэтому в форме
 * замены явно показано, что снимаем и что ставим: это две записи, а не правка
 * одной.
 *
 * 110C добавляет три вещи, без которых модулем нельзя пользоваться каждый день:
 * снятие без замены (деталь ушла, новая приедет завтра), исправление опечаток
 * и управление справочником. Правка трогает только административные поля —
 * даты, заявки и исполнителей интерфейс не предлагает менять, потому что это
 * следы произошедшего.
 *
 * Склада здесь нет: ни остатков, ни цен, ни списаний.
 */

function fmtDate(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function personLabel(p?: { firstName?: string | null; lastName?: string | null; email: string } | null) {
  if (!p) return null
  return [p.lastName, p.firstName].filter(Boolean).join(' ').trim() || p.email
}

function definitionLabel(part: api.InstalledPartItem) {
  const d = part.partDefinition
  if (!d) return null
  return [d.manufacturer, d.model].filter(Boolean).join(' ') || null
}

type Mode = 'none' | 'install' | 'replace' | 'remove' | 'edit'

type FormValue = {
  partDefinitionId: string
  displayName: string
  serialNumber: string
  quantity: string
  ticketId: string
  at: string
  comment: string
  removalComment: string
}

const emptyForm: FormValue = {
  partDefinitionId: '', displayName: '', serialNumber: '', quantity: '1',
  ticketId: '', at: '', comment: '', removalComment: '',
}

export function EquipmentPartsTab({
  equipmentId,
  scopeCompanyId,
  canManage,
}: {
  equipmentId: string
  scopeCompanyId?: string
  canManage: boolean
}) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<Mode>('none')
  const [target, setTarget] = useState<api.InstalledPartItem | null>(null)
  const [form, setForm] = useState<FormValue>(emptyForm)
  const [err, setErr] = useState<string | null>(null)
  const [catalogueOpen, setCatalogueOpen] = useState(false)

  const partsQ = useQuery({
    queryKey: ['equipment-parts', equipmentId, scopeCompanyId || ''],
    queryFn: () => api.getEquipmentParts(equipmentId, scopeCompanyId || undefined),
  })

  // Для выбора при установке нужны только действующие позиции.
  const definitionsQ = useQuery({
    queryKey: ['part-definitions', scopeCompanyId || ''],
    queryFn: () => api.listPartDefinitions({ companyId: scopeCompanyId || undefined }),
    enabled: canManage,
  })

  // Заявки для привязки берём из первой страницы истории — отдельного
  // эндпоинта для выбора заявки заводить незачем.
  const historyQ = useQuery({
    queryKey: ['equipment-history-tickets', equipmentId, scopeCompanyId || ''],
    queryFn: () => api.getEquipmentHistory(equipmentId, scopeCompanyId || undefined, { limit: 50 }),
    enabled: canManage,
  })

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['equipment-parts', equipmentId] }),
      qc.invalidateQueries({ queryKey: ['equipment-history', equipmentId] }),
      qc.invalidateQueries({ queryKey: ['equipment-history-tickets', equipmentId] }),
    ])
  }

  function done() {
    setErr(null); setMode('none'); setTarget(null)
  }
  function fail(e: any) {
    setErr(e?.message || String(e))
  }

  const installM = useMutation({
    mutationFn: (v: FormValue) =>
      api.installEquipmentPart(equipmentId, {
        partDefinitionId: v.partDefinitionId || undefined,
        displayName: v.displayName.trim() || undefined,
        serialNumber: v.serialNumber.trim() || undefined,
        quantity: v.quantity.trim() || undefined,
        installedAt: v.at || undefined,
        ticketId: v.ticketId || undefined,
        comment: v.comment.trim() || undefined,
      }),
    onSuccess: async () => { done(); await refresh() },
    onError: fail,
  })

  const replaceM = useMutation({
    mutationFn: (v: FormValue) =>
      api.replaceEquipmentPart(equipmentId, target!.id, {
        ticketId: v.ticketId,
        partDefinitionId: v.partDefinitionId || undefined,
        displayName: v.displayName.trim() || undefined,
        serialNumber: v.serialNumber.trim() || undefined,
        quantity: v.quantity.trim() || undefined,
        replacedAt: v.at || undefined,
        comment: v.comment.trim() || undefined,
        removalComment: v.removalComment.trim() || undefined,
      }),
    onSuccess: async () => { done(); await refresh() },
    onError: fail,
  })

  const removeM = useMutation({
    mutationFn: (v: FormValue) =>
      api.removeEquipmentPart(equipmentId, target!.id, {
        ticketId: v.ticketId || undefined,
        removedAt: v.at || undefined,
        removalComment: v.removalComment.trim() || undefined,
      }),
    onSuccess: async () => { done(); await refresh() },
    onError: fail,
  })

  const correctM = useMutation({
    mutationFn: (v: FormValue) =>
      api.correctEquipmentPart(equipmentId, target!.id, {
        serialNumber: v.serialNumber.trim(),
        quantity: v.quantity.trim() || undefined,
        comment: v.comment.trim(),
        partDefinitionId: v.partDefinitionId || '',
      }),
    onSuccess: async () => { done(); await refresh() },
    onError: fail,
  })

  const busy = installM.isPending || replaceM.isPending || removeM.isPending || correctM.isPending

  function begin(next: Mode, part?: api.InstalledPartItem) {
    setErr(null)
    setTarget(part ?? null)
    if (next === 'edit' && part) {
      setForm({
        ...emptyForm,
        partDefinitionId: part.partDefinitionId || '',
        displayName: part.displayName,
        serialNumber: part.serialNumber || '',
        quantity: part.quantity || '1',
        comment: part.comment || '',
      })
    } else if (next === 'replace' && part) {
      setForm({ ...emptyForm, quantity: part.quantity || '1' })
    } else {
      setForm(emptyForm)
    }
    setMode(next)
  }

  function patch(next: Partial<FormValue>) {
    setForm((cur) => ({ ...cur, ...next }))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setErr(null)
    if (mode === 'remove') { removeM.mutate(form); return }
    if (mode === 'edit') { correctM.mutate(form); return }
    if (!form.displayName.trim() && !form.partDefinitionId) {
      setErr('Укажите название или выберите позицию из справочника'); return
    }
    if (mode === 'replace') {
      if (!form.ticketId) { setErr('Для замены нужно указать заявку — это сервисная работа'); return }
      replaceM.mutate(form); return
    }
    installM.mutate(form)
  }

  if (partsQ.isLoading) return <div className="muted small">Загрузка комплектующих…</div>
  if (partsQ.isError) return <div className="alert">{(partsQ.error as any)?.message || String(partsQ.error)}</div>

  const installed = partsQ.data?.installed || []
  const history = partsQ.data?.history || []
  const tickets = historyQ.data?.tickets || []
  const definitions = definitionsQ.data || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {err ? <div className="alert">{err}</div> : null}

      {canManage && mode === 'none' ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => begin('install')} disabled={busy}>Добавить комплектующую</button>
          <button className="ghost" onClick={() => setCatalogueOpen((v) => !v)} disabled={busy}>
            {catalogueOpen ? 'Скрыть справочник' : 'Справочник'}
          </button>
        </div>
      ) : null}

      {canManage && catalogueOpen && mode === 'none' ? (
        <PartCatalogue scopeCompanyId={scopeCompanyId} equipmentLocationHint={tickets.length ? undefined : undefined} />
      ) : null}

      {mode !== 'none' ? (
        <form onSubmit={submit} className="panel" style={{ margin: 0 }}>
          <h4 style={{ marginTop: 0 }}>
            {mode === 'replace' ? 'Замена комплектующей'
              : mode === 'remove' ? 'Снятие комплектующей'
              : mode === 'edit' ? 'Исправление записи'
              : 'Новая комплектующая'}
          </h4>

          {target && mode !== 'edit' ? (
            <div className="muted small" style={{ marginBottom: 8 }}>
              <div><b>Что снимаем:</b> {target.displayName}{target.serialNumber ? ` · с/н ${target.serialNumber}` : ''}</div>
              <div>
                Стоит с {fmtDate(target.installedAt)}. Строка не удаляется — она останется в истории
                {mode === 'remove' ? ', замена не создаётся.' : '.'}
              </div>
            </div>
          ) : null}

          {mode === 'edit' ? (
            <div className="muted small" style={{ marginBottom: 8 }}>
              Правятся только административные поля. Даты установки и снятия, заявки
              и исполнители остаются как есть: это след произошедшего. Исправление
              записывается в журнал.
            </div>
          ) : null}

          {mode === 'install' || mode === 'replace' || mode === 'edit' ? (
            <>
              <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
                {mode === 'replace' ? 'Что устанавливаем — позиция справочника' : 'Позиция справочника'}
                <select
                  value={form.partDefinitionId}
                  onChange={(e) => {
                    const def = definitions.find((d) => d.id === e.target.value)
                    patch({ partDefinitionId: e.target.value, displayName: def ? def.name : form.displayName })
                  }}
                  style={{ width: '100%' }}
                >
                  <option value="">— без справочника, разовая деталь —</option>
                  {definitions.map((d) => (
                    <option key={d.id} value={d.id}>{[d.name, d.article].filter(Boolean).join(' · ')}</option>
                  ))}
                </select>
              </label>

              <div className="grid2">
                {mode !== 'edit' ? (
                  <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
                    Название
                    <input value={form.displayName} onChange={(e) => patch({ displayName: e.target.value })} style={{ width: '100%' }} />
                  </label>
                ) : null}
                <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
                  Серийный номер
                  <input value={form.serialNumber} onChange={(e) => patch({ serialNumber: e.target.value })} style={{ width: '100%' }} />
                </label>
                <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
                  Количество
                  <input value={form.quantity} onChange={(e) => patch({ quantity: e.target.value })} style={{ width: '100%' }} />
                </label>
                {mode !== 'edit' ? (
                  <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
                    Дата
                    <input type="date" value={form.at} onChange={(e) => patch({ at: e.target.value })} style={{ width: '100%' }} />
                  </label>
                ) : null}
              </div>
            </>
          ) : null}

          {mode === 'remove' ? (
            <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
              Дата снятия
              <input type="date" value={form.at} onChange={(e) => patch({ at: e.target.value })} style={{ width: '100%' }} />
            </label>
          ) : null}

          {mode !== 'edit' ? (
            <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
              По какой заявке{mode === 'replace' ? '' : ' (необязательно)'}
              <select value={form.ticketId} onChange={(e) => patch({ ticketId: e.target.value })} style={{ width: '100%' }}>
                <option value="">
                  — {mode === 'replace' ? 'выберите заявку'
                    : mode === 'remove' ? 'снятие без заявки'
                    : 'первичная комплектация, без заявки'} —
                </option>
                {tickets.map((t) => (
                  <option key={t.ticketId} value={t.ticketId}>
                    №{t.ticketNumber} · {fmtDate(t.createdAt)} · {t.problem.slice(0, 40)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {mode === 'install' ? (
            <div className="muted small" style={{ marginBottom: 8 }}>
              Заявка не обязательна: первичная комплектация — административная операция.
            </div>
          ) : null}

          {mode === 'replace' || mode === 'remove' ? (
            <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
              Комментарий к снятию
              <input value={form.removalComment} onChange={(e) => patch({ removalComment: e.target.value })} style={{ width: '100%' }} />
            </label>
          ) : null}

          {mode !== 'remove' ? (
            <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
              Комментарий{mode === 'edit' ? '' : ' к установке'}
              <input value={form.comment} onChange={(e) => patch({ comment: e.target.value })} style={{ width: '100%' }} />
            </label>
          ) : null}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={busy}>
              {mode === 'replace' ? 'Заменить' : mode === 'remove' ? 'Снять' : mode === 'edit' ? 'Сохранить' : 'Добавить'}
            </button>
            <button type="button" className="ghost" onClick={done} disabled={busy}>Отмена</button>
          </div>
        </form>
      ) : null}

      <div>
        <h4 style={{ margin: '0 0 6px' }}>Установлено сейчас</h4>
        {installed.length === 0 ? (
          <div className="muted small">Комплектующие пока не заведены.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {installed.map((part) => (
              <div key={part.id} className="panel" style={{ margin: 0 }}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {part.displayName}
                      {Number(part.quantity) !== 1 ? ` × ${part.quantity}${part.unit ? ' ' + part.unit : ''}` : ''}
                    </div>
                    {definitionLabel(part) ? <div className="muted small">{definitionLabel(part)}</div> : null}
                    <div className="muted small">
                      {[
                        part.serialNumber ? `с/н ${part.serialNumber}` : null,
                        `с ${fmtDate(part.installedAt)}`,
                        personLabel(part.installedBy),
                      ].filter(Boolean).join(' · ')}
                    </div>
                    {part.installedTicket ? (
                      <div className="muted small">
                        Установлено по заявке{' '}
                        <Link to={`/tickets/${part.installedTicket.id}`}>№{part.installedTicket.ticketNumber}</Link>
                      </div>
                    ) : (
                      <div className="muted small">Первичная комплектация, без заявки</div>
                    )}
                    {part.comment ? <div className="muted small">{part.comment}</div> : null}
                  </div>
                  {canManage ? (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button className="ghost" onClick={() => begin('replace', part)} disabled={busy}>Заменить</button>
                      <button className="ghost" onClick={() => begin('remove', part)} disabled={busy}>Снять</button>
                      <button className="ghost" onClick={() => begin('edit', part)} disabled={busy}>Изменить</button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h4 style={{ margin: '0 0 6px' }}>История замен</h4>
        {history.length === 0 ? (
          <div className="muted small">Снятых комплектующих пока нет.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {history.map((part) => (
              <div key={part.id} className="panel" style={{ margin: 0, opacity: 0.85 }}>
                <div style={{ fontWeight: 600 }}>{part.displayName}</div>
                {definitionLabel(part) ? <div className="muted small">{definitionLabel(part)}</div> : null}
                <div className="muted small">
                  {[
                    part.serialNumber ? `с/н ${part.serialNumber}` : null,
                    `${fmtDate(part.installedAt)} — ${fmtDate(part.removedAt)}`,
                    personLabel(part.removedBy) ? `снял ${personLabel(part.removedBy)}` : null,
                  ].filter(Boolean).join(' · ')}
                </div>
                {part.installedTicket ? (
                  <div className="muted small">
                    Установлено по заявке{' '}
                    <Link to={`/tickets/${part.installedTicket.id}`}>№{part.installedTicket.ticketNumber}</Link>
                  </div>
                ) : null}
                {part.removedTicket ? (
                  <div className="muted small">
                    Снято по заявке{' '}
                    <Link to={`/tickets/${part.removedTicket.id}`}>№{part.removedTicket.ticketNumber}</Link>
                  </div>
                ) : (
                  <div className="muted small">Снято без заявки</div>
                )}
                {part.removalComment ? <div className="muted small">{part.removalComment}</div> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * SMA-EQUIPMENT-PARTS-POLISH-110C.
 *
 * Управление справочником. Намеренно скромное: создать, поправить, вывести
 * из обращения, найти. Удаления нет — на позицию ссылаются исторические
 * строки, и удаление обрубило бы им связь. Складского тоже нет.
 */
function PartCatalogue({
  scopeCompanyId,
}: {
  scopeCompanyId?: string
  equipmentLocationHint?: string
}) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState({ name: '', manufacturer: '', model: '', article: '', unit: 'шт' })
  const [err, setErr] = useState<string | null>(null)

  const q = useQuery({
    queryKey: ['part-definitions-manage', scopeCompanyId || '', search],
    queryFn: () =>
      api.listPartDefinitions({
        companyId: scopeCompanyId || undefined,
        search: search || undefined,
        includeInactive: true,
      }),
  })

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['part-definitions-manage'] }),
      qc.invalidateQueries({ queryKey: ['part-definitions'] }),
    ])
  }

  const updateM = useMutation({
    mutationFn: (params: { id: string; input: Parameters<typeof api.updatePartDefinition>[1] }) =>
      api.updatePartDefinition(params.id, params.input),
    onSuccess: async () => { setErr(null); setEditing(null); await refresh() },
    onError: (e: any) => setErr(e?.message || String(e)),
  })

  const rows = q.data || []

  return (
    <div className="panel" style={{ margin: 0 }}>
      <h4 style={{ marginTop: 0 }}>Справочник комплектующих</h4>
      {err ? <div className="alert">{err}</div> : null}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск по названию, производителю, артикулу"
        style={{ width: '100%', marginBottom: 8 }}
      />

      {q.isLoading ? <div className="muted small">Загрузка…</div> : null}
      {rows.length === 0 && !q.isLoading ? (
        <div className="muted small">
          Позиций пока нет. Первую можно завести при добавлении комплектующей.
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((d) => (
          <div key={d.id} className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
            {editing === d.id ? (
              <div style={{ flex: 1 }}>
                <div className="grid2">
                  <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Название" />
                  <input value={draft.article} onChange={(e) => setDraft({ ...draft, article: e.target.value })} placeholder="Артикул" />
                  <input value={draft.manufacturer} onChange={(e) => setDraft({ ...draft, manufacturer: e.target.value })} placeholder="Производитель" />
                  <input value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} placeholder="Модель" />
                  <input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} placeholder="Единица" />
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button onClick={() => updateM.mutate({ id: d.id, input: draft })} disabled={updateM.isPending}>
                    Сохранить
                  </button>
                  <button className="ghost" onClick={() => setEditing(null)} disabled={updateM.isPending}>Отмена</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, opacity: d.isActive ? 1 : 0.6 }}>
                    {d.name}
                    {!d.isActive ? <span className="muted small"> · выведена из обращения</span> : null}
                  </div>
                  <div className="muted small">
                    {[d.manufacturer, d.model, d.article, d.unit].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    className="ghost"
                    onClick={() => {
                      setEditing(d.id)
                      setDraft({
                        name: d.name, manufacturer: d.manufacturer || '', model: d.model || '',
                        article: d.article || '', unit: d.unit || 'шт',
                      })
                    }}
                    disabled={updateM.isPending}
                  >
                    Изменить
                  </button>
                  <button
                    className="ghost"
                    onClick={() => updateM.mutate({ id: d.id, input: { isActive: !d.isActive } })}
                    disabled={updateM.isPending}
                  >
                    {d.isActive ? 'Вывести' : 'Вернуть'}
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <p className="muted small" style={{ marginBottom: 0 }}>
        Выведенная позиция не предлагается при установке, но остаётся в истории
        и её можно вернуть. Удаления нет намеренно: на позицию ссылаются записи.
      </p>
    </div>
  )
}
