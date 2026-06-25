import { useState, useEffect, useCallback } from 'react'
import { IconCalendarOff } from '@tabler/icons-react'
import * as api from '../api/client'
import { analyticsContextFromApi, analyticsOverviewFromApi, ANALYTICS_STATUS, type DisplayLocationStat, type DisplayOverview } from '../api/mappers'

const ADMIN_ROLES = ['ADMIN', 'MASTER', 'DISPATCHER', 'NETWORK_DIRECTOR']

// Экран «Аналитика» (живой режим). TECHNICIAN → только контекст по локациям; ADMIN → + обзор.
export function AnalyticsScreen({ role }: { role: string }) {
  const isAdmin = ADMIN_ROLES.includes(role)

  const [locations, setLocations] = useState<DisplayLocationStat[]>([])
  const [totalTickets, setTotalTickets] = useState(0)
  const [ctxLoading, setCtxLoading] = useState(true)
  const [ctxError, setCtxError] = useState<string | null>(null)

  const [overview, setOverview] = useState<DisplayOverview | null>(null)
  const [ovLoading, setOvLoading] = useState(isAdmin)
  const [ovError, setOvError] = useState<string | null>(null)

  const loadContext = useCallback(async () => {
    setCtxLoading(true); setCtxError(null)
    try {
      const r = analyticsContextFromApi(await api.getTicketsAnalyticsContext())
      setLocations(r.locations); setTotalTickets(r.totalTickets)
    } catch (e: any) { setCtxError(e?.message || 'Не удалось загрузить аналитику') }
    finally { setCtxLoading(false) }
  }, [])

  const loadOverview = useCallback(async () => {
    if (!isAdmin) return
    setOvLoading(true); setOvError(null)
    try { setOverview(analyticsOverviewFromApi(await api.getAnalyticsOverview())) }
    catch (e: any) { setOvError(e?.status === 403 ? 'Обзор доступен только администратору' : (e?.message || 'Ошибка обзора')) }
    finally { setOvLoading(false) }
  }, [isAdmin])

  useEffect(() => { loadContext(); loadOverview() }, [loadContext, loadOverview])

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="bg-white px-4 pt-3 pb-3 border-b border-slate-100 flex-shrink-0">
        <h1 className="text-[18px] font-bold text-slate-900">Аналитика</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50 flex flex-col gap-4" style={{ scrollbarWidth: 'none' }}>

        {/* ── Обзор (только admin) ── */}
        {isAdmin && (
          <section>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">Обзор</p>
            {ovLoading && <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-[13px] text-slate-400">Загрузка…</div>}
            {ovError && !ovLoading && <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-[12px] text-amber-700">{ovError}</div>}
            {overview && !ovLoading && !ovError && (<div className="flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-white rounded-2xl border border-slate-200 p-3.5"><p className="text-[22px] font-bold text-slate-800 leading-none mb-1">{overview.openTotal}</p><p className="text-[11px] text-slate-400">Открытых всего</p></div>
                <div className="bg-white rounded-2xl border border-slate-200 p-3.5"><p className="text-[22px] font-bold text-orange-600 leading-none mb-1">{overview.unassigned}</p><p className="text-[11px] text-slate-400">Без исполнителя</p></div>
              </div>
              {/* SLA */}
              <div className="bg-white rounded-2xl border border-slate-200 p-3.5">
                <div className="flex items-center justify-between mb-2"><p className="text-[12px] font-bold text-slate-600">SLA</p><p className="text-[11px] text-slate-400">оценено: {overview.slaEvaluated}</p></div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden flex"><div className="h-full bg-emerald-500" style={{ width: `${overview.slaOkPercent}%` }} /><div className="h-full bg-red-500" style={{ width: `${overview.slaBreachedPercent}%` }} /></div>
                <div className="flex items-center justify-between mt-1.5 text-[11px]"><span className="text-emerald-600 font-semibold">{overview.slaOkPercent}% в срок</span><span className="text-red-600 font-semibold">{overview.slaBreachedPercent}% просрочено</span></div>
              </div>
              {/* Timing */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-white rounded-2xl border border-slate-200 p-3.5"><p className="text-[15px] font-bold text-slate-800 leading-none mb-1">{overview.assignLabel}</p><p className="text-[11px] text-slate-400">Среднее назначение</p></div>
                <div className="bg-white rounded-2xl border border-slate-200 p-3.5"><p className="text-[15px] font-bold text-slate-800 leading-none mb-1">{overview.resolveLabel}</p><p className="text-[11px] text-slate-400">Среднее закрытие</p></div>
              </div>
              {/* Нагрузка по техникам */}
              {overview.workload.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 py-2.5 border-b border-slate-50">Нагрузка по техникам</p>
                  {overview.workload.map((w, i, arr) => (
                    <div key={w.id} className={`flex items-center justify-between px-4 py-2.5 ${i < arr.length - 1 ? 'border-b border-slate-50' : ''}`}>
                      <span className="text-[12px] font-mono text-slate-600">{w.name}</span>
                      <div className="flex items-center gap-3 text-[11px]"><span className="text-blue-600">назн. {w.assigned}</span><span className="text-amber-600">в раб. {w.inProgress}</span><span className="font-bold text-slate-700">актив. {w.active}</span></div>
                    </div>
                  ))}
                </div>
              )}
            </div>)}
          </section>
        )}

        {/* ── По локациям (context) ── */}
        <section>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">По локациям</p>
          {ctxLoading && <div className="flex flex-col items-center gap-2 py-10"><span className="text-[28px] animate-pulse">⏳</span><p className="text-[13px] text-slate-500">Загрузка…</p></div>}
          {ctxError && !ctxLoading && (
            <div className="flex flex-col items-center gap-3 py-8"><span className="text-[36px]">⚠️</span><p className="text-[13px] text-slate-600 text-center px-6">{ctxError}</p><button onClick={loadContext} className="text-[12px] font-bold text-white bg-blue-600 px-4 py-2 rounded-xl">Повторить</button></div>
          )}
          {!ctxLoading && !ctxError && locations.length === 0 && <div className="flex flex-col items-center gap-2 py-10"><span className="text-[32px]">📊</span><p className="text-[13px] text-slate-500">Данных нет</p></div>}
          {!ctxLoading && !ctxError && locations.length > 0 && (
            <div className="flex flex-col gap-2.5">
              {locations.map((l) => (
                <div key={l.locationId} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5">
                  <div className="flex items-center justify-between mb-2"><p className="text-[13px] font-bold text-slate-800 truncate">{l.locationName}</p><span className="text-[12px] font-bold text-slate-700">{l.total}</span></div>
                  {/* мини-бар статусов */}
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex">
                    {l.segments.filter(s => s.count > 0).map(s => <div key={s.key} className={`h-full ${s.bar}`} style={{ width: `${s.pct}%` }} />)}
                  </div>
                  {/* легенда */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                    {ANALYTICS_STATUS.map(s => (
                      <span key={s.key} className="flex items-center gap-1 text-[10px] text-slate-500"><span className={`w-2 h-2 rounded-full ${s.dot}`} />{s.label}: <b className="text-slate-700">{(l as any)[s.key]}</b></span>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-center text-[11px] text-slate-400 mt-1">Итого заявок: <b className="text-slate-600">{totalTickets}</b></p>
            </div>
          )}
        </section>

        {/* ── Планирование (нет API) ── */}
        <section>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">Планирование</p>
          <div className="bg-white rounded-2xl border border-slate-200 px-4 py-6 flex flex-col items-center gap-2">
            <IconCalendarOff size={32} className="text-slate-300" />
            {/* TODO: нет в API — schedule/calendar endpoints отсутствуют */}
            <p className="text-[12px] text-slate-400 text-center">Расписание и календарь — нет в API</p>
          </div>
        </section>

        <div className="h-2" />
      </div>
    </div>
  )
}

export default AnalyticsScreen
