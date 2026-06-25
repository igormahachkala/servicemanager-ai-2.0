import { useState, useEffect, useCallback } from 'react'
import { IconChevronLeft } from '@tabler/icons-react'
import * as api from '../api/client'

type Toast = (t: string, tp?: 'success' | 'error' | 'info') => void

// Экран «На приёмке» (live): визуал из Figma Make.
// GET /tickets?status=AWAITING_ACCEPTANCE, группировка по локации.
// Принять → POST /tickets/:id/acceptance {decision:'ACCEPT'} (реальный контракт, не {status:'DONE'}).
// Отклонить → модал (комментарий+фото) → {decision:'REJECT', comment}.
export function AwaitingScreen({ onBack, onOpenChat, addToast }: {
  onBack: () => void
  onOpenChat?: (ticketId: string, title: string) => void
  addToast: Toast
}) {
  const [items, setItems] = useState<api.TicketListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<{ id: string; number?: number | null; comment: string; hasPhoto: boolean; err: string } | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); setError(null)
    try {
      const r = await api.ticketsList('AWAITING_ACCEPTANCE')
      setItems(Array.isArray(r) ? r : [])
    } catch (e: any) { setError(e?.message || 'Не удалось загрузить') }
    finally { if (!silent) setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function accept(t: api.TicketListItem) {
    setBusy(t.id)
    try { await api.acceptance(t.id, { decision: 'ACCEPT' }); addToast(`Заявка #${t.ticketNumber} принята ✓`, 'success'); await load(true) }
    catch (e: any) { addToast(e?.message || 'Не удалось принять', 'error') }
    finally { setBusy(null) }
  }
  async function submitReject() {
    if (!rejectModal) return
    if (rejectModal.comment.trim().length < 3) { setRejectModal(p => p ? { ...p, err: 'Комментарий обязателен' } : p); return }
    if (!rejectModal.hasPhoto) { setRejectModal(p => p ? { ...p, err: 'Фото обязательно' } : p); return }
    const { id, number, comment } = rejectModal
    setRejectModal(null); setBusy(id)
    try { await api.acceptance(id, { decision: 'REJECT', comment: comment.trim() }); addToast(`Заявка #${number} отправлена на доработку`, 'info'); await load(true) }
    catch (e: any) { addToast(e?.message || 'Не удалось отклонить', 'error') }
    finally { setBusy(null) }
  }

  // группировка по локации
  const groupsMap = new Map<string, { name: string; items: api.TicketListItem[] }>()
  for (const t of items) {
    const key = t.location?.id || t.locationId || t.pointName || 'unknown'
    let g = groupsMap.get(key)
    if (!g) { g = { name: t.location?.name || t.pointName || 'Без объекта', items: [] }; groupsMap.set(key, g) }
    g.items.push(t)
  }
  const groups = [...groupsMap.values()]
  const total = items.length

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {rejectModal && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3"><h3 className="text-[15px] font-bold">Не принять работу</h3><button onClick={() => setRejectModal(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button></div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5 mb-4 flex items-start gap-2"><span>⚠️</span><p className="text-[11px] text-orange-700 font-medium">Комментарий и фото обязательны. Заявка вернётся исполнителю.</p></div>
            {rejectModal.err && <p className="text-[11px] text-red-600 mb-2 font-semibold">{rejectModal.err}</p>}
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Причина отказа *</label>
            <textarea className="mt-1.5 mb-3 w-full bg-slate-50 rounded-xl px-3 py-2.5 text-[13px] text-slate-800 outline-none border border-slate-200 resize-none" rows={3} placeholder="Что не принято и что нужно доделать?" value={rejectModal.comment} onChange={e => setRejectModal(p => p ? { ...p, comment: e.target.value, err: '' } : p)} />
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Фото *</label>
            <div className="mt-1.5 mb-4">{!rejectModal.hasPhoto ? <button onClick={() => setRejectModal(p => p ? { ...p, hasPhoto: true } : p)} className="w-full py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-600">📷 Добавить фото</button> : <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 flex items-center gap-2"><span className="text-emerald-600">✓</span><span className="text-[12px] font-semibold text-emerald-700">Фото добавлено</span></div>}</div>
            <button onClick={submitReject} className={`w-full py-3.5 rounded-2xl font-bold text-[14px] ${rejectModal.comment.length >= 3 && rejectModal.hasPhoto ? 'bg-red-600 text-white shadow-lg shadow-red-200' : 'bg-slate-100 text-slate-400'}`}>Отправить на доработку</button>
          </div>
        </div>
      )}

      <div className="bg-white border-b border-slate-100 flex-shrink-0 flex items-center gap-2 px-3 py-2.5">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 active:bg-slate-200"><IconChevronLeft size={18} className="text-slate-700" /></button>
        <div className="flex-1 min-w-0"><h1 className="text-[15px] font-bold text-slate-900 leading-tight">На приёмке</h1><p className="text-[11px] text-slate-400">{total} заявок ожидают решения</p></div>
      </div>

      {loading && <div className="flex-1 flex flex-col items-center justify-center gap-2"><span className="text-[28px] animate-pulse">⏳</span><p className="text-[13px] text-slate-500">Загрузка…</p></div>}
      {error && !loading && <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6"><span className="text-[36px]">⚠️</span><p className="text-[13px] text-slate-600 text-center">{error}</p><button onClick={() => load()} className="text-[12px] font-bold text-white bg-blue-600 px-4 py-2 rounded-xl">Повторить</button></div>}
      {!loading && !error && total === 0 && <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6"><span className="text-[56px]">✅</span><p className="text-[16px] font-bold text-slate-700">Всё принято</p></div>}

      {!loading && !error && total > 0 && (
        <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50" style={{ scrollbarWidth: 'none' }}>
          {groups.map((group, gi) => (
            <div key={gi} className="mb-4">
              <div className="flex items-center gap-2 mb-2"><span className="text-[16px]">🏢</span><p className="text-[13px] font-bold text-slate-700">{group.name}</p><span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{group.items.length}</span></div>
              {group.items.map(t => (
                <div key={t.id} className="bg-white rounded-2xl border border-amber-200 shadow-sm p-3.5 mb-2">
                  <div className="flex items-start justify-between mb-2.5">
                    <div className="flex-1 min-w-0"><p className="text-[11px] font-bold text-slate-500 mb-0.5">#{t.ticketNumber} · {t.problemCategory?.name || '—'}</p><p className="text-[13px] font-semibold text-slate-800 leading-snug">{t.problemText || 'Без описания'}</p></div>
                    {onOpenChat && <button onClick={() => onOpenChat(t.id, `#${t.ticketNumber} ${t.problemText || ''}`.trim())} className="ml-2 flex-shrink-0 text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">Чат</button>}
                  </div>
                  <div className="flex gap-2">
                    <button disabled={busy === t.id} onClick={() => accept(t)} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-[12px] font-bold active:scale-95 transition-transform shadow-sm shadow-emerald-200 disabled:opacity-50">✓ Принять</button>
                    <button disabled={busy === t.id} onClick={() => setRejectModal({ id: t.id, number: t.ticketNumber, comment: '', hasPhoto: false, err: '' })} className="flex-1 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded-xl text-[12px] font-bold active:scale-95 transition-transform disabled:opacity-50">✗ Отклонить</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AwaitingScreen
