import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../../lib/api'

/**
 * SMA-EQUIPMENT-HISTORY-PARTS-110B.
 *
 * Вкладка «Компоненты»: что стоит сейчас и что снимали раньше.
 *
 * Замена не переписывает строку. Старая закрывается датой снятия и заявкой,
 * новая заводится отдельной записью — обе остаются видимыми. Поэтому в форме
 * замены явно показано, что снимаем и что ставим: это две записи, а не правка
 * одной.
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
  partDefinitionId: '',
  displayName: '',
  serialNumber: '',
  quantity: '1',
  ticketId: '',
  at: '',
  comment: '',
  removalComment: '',
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
  const [mode, setMode] = useState<'none' | 'install' | 'replace'>('none')
  const [target, setTarget] = useState<api.InstalledPartItem | null>(null)
  const [form, setForm] = useState<FormValue>(emptyForm)
  const [err, setErr] = useState<string | null>(null)

  const partsQ = useQuery({
    queryKey: ['equipment-parts', equipmentId, scopeCompanyId || ''],
    queryFn: () => api.getEquipmentParts(equipmentId, scopeCompanyId || undefined),
  })

  const definitionsQ = useQuery({
    queryKey: ['part-definitions', scopeCompanyId || ''],
    queryFn: () => api.listPartDefinitions({ companyId: scopeCompanyId || undefined }),
    enabled: canManage,
  })

  // Заявки для привязки берём из той же истории — отдельного эндпоинта
  // для выбора заявки заводить незачем.
  const historyQ = useQuery({
    queryKey: ['equipment-history', equipmentId, scopeCompanyId || ''],
    queryFn: () => api.getEquipmentHistory(equipmentId, scopeCompanyId || undefined),
    enabled: canManage,
  })

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['equipment-parts', equipmentId] }),
      qc.invalidateQueries({ queryKey: ['equipment-history', equipmentId] }),
    ])
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
    onSuccess: async () => { setErr(null); setMode('none'); await refresh() },
    onError: (e: any) => setErr(e?.message || String(e)),
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
    onSuccess: async () => { setErr(null); setMode('none'); setTarget(null); await refresh() },
    onError: (e: any) => setErr(e?.message || String(e)),
  })

  const busy = installM.isPending || replaceM.isPending

  function beginInstall() {
    setErr(null); setTarget(null); setForm(emptyForm); setMode('install')
  }
  function beginReplace(part: api.InstalledPartItem) {
    setErr(null); setTarget(part)
    setForm({ ...emptyForm, quantity: part.quantity || '1' })
    setMode('replace')
  }
  function patch(next: Partial<FormValue>) {
    setForm((cur) => ({ ...cur, ...next }))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setErr(null)
    const named = form.displayName.trim() || form.partDefinitionId
    if (!named) { setErr('Укажите название или выберите позицию из справочника'); return }
    if (mode === 'replace') {
      if (!form.ticketId) { setErr('Для замены нужно указать заявку — это сервисная работа'); return }
      replaceM.mutate(form)
      return
    }
    installM.mutate(form)
  }

  if (partsQ.isLoading) return <div className="muted small">Загрузка комплектующих…</div>
  if (partsQ.isError) return <div className="alert">{(partsQ.error as any)?.message || String(partsQ.error)}</div>

  const installed = partsQ.data?.installed || []
  const history = partsQ.data?.history || []
  const tickets = historyQ.data?.tickets || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {err ? <div className="alert">{err}</div> : null}

      {canManage && mode === 'none' ? (
        <div>
          <button onClick={beginInstall} disabled={busy}>Добавить комплектующую</button>
        </div>
      ) : null}

      {mode !== 'none' ? (
        <form onSubmit={submit} className="panel" style={{ margin: 0 }}>
          <h4 style={{ marginTop: 0 }}>
            {mode === 'replace' ? 'Замена комплектующей' : 'Новая комплектующая'}
          </h4>

          {mode === 'replace' && target ? (
            <div className="muted small" style={{ marginBottom: 8 }}>
              <div><b>Что снимаем:</b> {target.displayName}{target.serialNumber ? ` · с/н ${target.serialNumber}` : ''}</div>
              <div>Стоит с {fmtDate(target.installedAt)}. Строка не удаляется — она останется в истории замен.</div>
            </div>
          ) : null}

          <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
            {mode === 'replace' ? 'Что устанавливаем — позиция справочника' : 'Позиция справочника'}
            <select
              value={form.partDefinitionId}
              onChange={(e) => {
                const def = (definitionsQ.data || []).find((d) => d.id === e.target.value)
                patch({ partDefinitionId: e.target.value, displayName: def ? def.name : form.displayName })
              }}
              style={{ width: '100%' }}
            >
              <option value="">— без справочника, разовая деталь —</option>
              {(definitionsQ.data || []).map((d) => (
                <option key={d.id} value={d.id}>
                  {[d.name, d.article].filter(Boolean).join(' · ')}
                </option>
              ))}
            </select>
          </label>

          <div className="grid2">
            <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
              Название
              <input value={form.displayName} onChange={(e) => patch({ displayName: e.target.value })} style={{ width: '100%' }} />
            </label>
            <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
              Серийный номер
              <input value={form.serialNumber} onChange={(e) => patch({ serialNumber: e.target.value })} style={{ width: '100%' }} />
            </label>
            <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
              Количество
              <input value={form.quantity} onChange={(e) => patch({ quantity: e.target.value })} style={{ width: '100%' }} />
            </label>
            <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
              Дата
              <input type="date" value={form.at} onChange={(e) => patch({ at: e.target.value })} style={{ width: '100%' }} />
            </label>
          </div>

          <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
            По какой заявке{mode === 'replace' ? '' : ' (необязательно)'}
            <select value={form.ticketId} onChange={(e) => patch({ ticketId: e.target.value })} style={{ width: '100%' }}>
              <option value="">— {mode === 'replace' ? 'выберите заявку' : 'первичная комплектация, без заявки'} —</option>
              {tickets.map((t) => (
                <option key={t.ticketId} value={t.ticketId}>
                  №{t.ticketNumber} · {fmtDate(t.createdAt)} · {t.problem.slice(0, 40)}
                </option>
              ))}
            </select>
          </label>
          {mode === 'install' ? (
            <div className="muted small" style={{ marginBottom: 8 }}>
              Заявка не обязательна: первичная комплектация — административная операция.
              Придумывать под неё заявку не нужно.
            </div>
          ) : null}

          {mode === 'replace' ? (
            <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
              Комментарий к снятию
              <input value={form.removalComment} onChange={(e) => patch({ removalComment: e.target.value })} style={{ width: '100%' }} />
            </label>
          ) : null}

          <label className="muted small" style={{ display: 'block', marginBottom: 8 }}>
            Комментарий к установке
            <input value={form.comment} onChange={(e) => patch({ comment: e.target.value })} style={{ width: '100%' }} />
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={busy}>{mode === 'replace' ? 'Заменить' : 'Добавить'}</button>
            <button type="button" className="ghost" onClick={() => { setMode('none'); setTarget(null) }} disabled={busy}>
              Отмена
            </button>
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
                    <button className="ghost" onClick={() => beginReplace(part)} disabled={busy}>
                      Заменить
                    </button>
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
          <div className="muted small">Замен пока не было.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {history.map((part) => (
              <div key={part.id} className="panel" style={{ margin: 0, opacity: 0.85 }}>
                <div style={{ fontWeight: 600 }}>{part.displayName}</div>
                <div className="muted small">
                  {[
                    part.serialNumber ? `с/н ${part.serialNumber}` : null,
                    `${fmtDate(part.installedAt)} — ${fmtDate(part.removedAt)}`,
                    personLabel(part.removedBy) ? `снял ${personLabel(part.removedBy)}` : null,
                  ].filter(Boolean).join(' · ')}
                </div>
                {part.removedTicket ? (
                  <div className="muted small">
                    Снято по заявке{' '}
                    <Link to={`/tickets/${part.removedTicket.id}`}>№{part.removedTicket.ticketNumber}</Link>
                  </div>
                ) : null}
                {part.removalComment ? <div className="muted small">{part.removalComment}</div> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
