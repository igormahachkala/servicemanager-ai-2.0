import { useState, useEffect, useCallback } from 'react'
import { IconChevronRight, IconMessageCircle } from '@tabler/icons-react'
import * as api from '../api/client'
import { ticketStatusLabel, ticketStatusBadge } from '../api/mappers'

type CTab = 'tickets' | 'objects' | 'archive'

function fmtDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}.${mm} ${hh}:${mi}`
}

// Вкладка «Чаты» (живой режим). «Заявки» = треды из timeline; «Объекты»/«Архив» — мок (нет API).
export function ChatsScreen({ onOpenChat }: { onOpenChat: (t: api.TicketListItem) => void }) {
  const [tab, setTab] = useState<CTab>('tickets')
  const [tickets, setTickets] = useState<api.TicketListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const r = await api.ticketsList()
      setTickets(Array.isArray(r) ? r : [])
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить чаты')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="bg-white px-4 pt-3 pb-2 border-b border-slate-100 flex-shrink-0">
        <h1 className="text-[18px] font-bold text-slate-900 mb-2">Чаты</h1>
        <div className="flex bg-slate-100 rounded-xl p-1">
          {([['tickets', 'Заявки'], ['objects', 'Объекты'], ['archive', 'Архив']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex-1 py-2 text-[12px] transition-all ${tab === k ? 'bg-white rounded-lg shadow-sm font-semibold text-blue-600' : 'text-slate-400'}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50" style={{ scrollbarWidth: 'none' }}>
        {/* «Объекты» и «Архив» — нет в API */}
        {tab !== 'tickets' && (
          <div className="flex flex-col items-center gap-3 py-14">
            <IconMessageCircle size={40} className="text-slate-300" />
            <p className="text-[13px] text-slate-500">{tab === 'objects' ? 'Чаты объектов' : 'Архив'} — нет в API</p>
            <p className="text-[11px] text-slate-400 text-center px-8">{/* TODO: нет в API */}Backend предоставляет только тред заявки (timeline + comments). Чат объекта/архив — мок.</p>
          </div>
        )}

        {tab === 'tickets' && (<>
          {loading && <div className="flex flex-col items-center gap-2 py-12"><span className="text-[28px] animate-pulse">⏳</span><p className="text-[13px] text-slate-500">Загрузка…</p></div>}
          {error && !loading && (
            <div className="flex flex-col items-center gap-3 py-10">
              <span className="text-[36px]">⚠️</span>
              <p className="text-[13px] text-slate-600 text-center px-6">{error}</p>
              <button onClick={load} className="text-[12px] font-bold text-white bg-blue-600 px-4 py-2 rounded-xl">Повторить</button>
            </div>
          )}
          {!loading && !error && tickets.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-14"><IconMessageCircle size={40} className="text-slate-300" /><p className="text-[13px] text-slate-500">Чатов нет</p></div>
          )}
          {!loading && !error && tickets.length > 0 && (
            <div className="flex flex-col gap-2">
              {tickets.map(t => (
                <button key={t.id} onClick={() => onOpenChat(t)} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 text-left active:scale-[0.99] transition-transform">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[11px] font-bold text-slate-400 flex-shrink-0">#{t.ticketNumber}</span>
                      <p className="text-[13px] font-bold text-slate-800 truncate">{t.problemText || 'Без описания'}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${ticketStatusBadge(t.status)}`}>{ticketStatusLabel(t.status)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-400 truncate">{t.location?.name || t.pointName || '—'} · {fmtDate(t.statusUpdatedAt || t.createdAt)}</p>
                    <IconChevronRight size={16} className="text-slate-300 flex-shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </>)}
      </div>
    </div>
  )
}

export default ChatsScreen
