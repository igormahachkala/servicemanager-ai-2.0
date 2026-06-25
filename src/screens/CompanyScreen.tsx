import { useState, useEffect } from 'react'
import { IconChevronLeft } from '@tabler/icons-react'
import * as api from '../api/client'
import type { ServiceObject } from '../api/mappers'

// Компания: визуал из Figma Make; компания из /auth/me, статистика+объекты из board (live).
export function CompanyScreen({ onBack, objects }: { onBack: () => void; objects: ServiceObject[] }) {
  const [me, setMe] = useState<api.Me | null>(null)
  useEffect(() => { api.me().then(setMe).catch(() => {}) }, [])

  const companyName = me?.companyName || 'Компания'
  const activeTickets = objects.reduce((s, o) => s + o.counts.newCount + o.counts.assigned + o.counts.inWork + o.counts.awaiting, 0)
  const awaiting = objects.reduce((s, o) => s + o.counts.awaiting, 0)
  const overdue = objects.reduce((s, o) => s + o.counts.overdue, 0)

  // Реальное из board + TODO для полей, которых нет в API (сотрудники/подрядчики)
  const stats = [
    { icon: '🏢', label: 'Объектов', val: String(objects.length), col: 'text-blue-700', bg: 'bg-blue-50' },
    { icon: '👷', label: 'Сотрудников', val: '—', col: 'text-violet-700', bg: 'bg-violet-50' }, // TODO: нет в API
    { icon: '🎫', label: 'Активных заявок', val: String(activeTickets), col: 'text-orange-600', bg: 'bg-orange-50' },
    { icon: '🤝', label: 'Подрядчиков', val: '—', col: 'text-emerald-700', bg: 'bg-emerald-50' }, // TODO: нет в API
    { icon: '⏳', label: 'На приёмке', val: String(awaiting), col: 'text-amber-700', bg: 'bg-amber-50' },
    { icon: '⚠️', label: 'Просрочено', val: String(overdue), col: 'text-red-700', bg: 'bg-red-50' },
  ]

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="bg-white border-b border-slate-100 flex-shrink-0 flex items-center gap-2 px-3 py-2.5">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 active:bg-slate-200"><IconChevronLeft size={18} className="text-slate-700" /></button>
        <h1 className="text-[15px] font-bold text-slate-900">Компания</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50" style={{ scrollbarWidth: 'none' }}>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-md"><span className="text-white text-[22px] font-bold">{(companyName[0] || 'К').toUpperCase()}</span></div>
          <div><p className="text-[17px] font-bold text-slate-900">{companyName}</p><p className="text-[12px] text-slate-400">{me?.role === 'CLIENT' || me?.role === 'ADMIN' ? 'Клиентская компания' : 'Компания'}</p><span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mt-1 inline-block">{me?.isActive === false ? 'Неактивна' : 'Активна'}</span></div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {stats.map(s => <div key={s.label} className={`rounded-2xl p-4 border-transparent border ${s.bg}`}><div className="flex items-center gap-2 mb-1"><span className="text-[18px]">{s.icon}</span><p className="text-[10px] text-slate-400 font-medium">{s.label}</p></div><p className={`text-[28px] font-bold ${s.col}`}>{s.val}</p></div>)}
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-4 py-3 border-b border-slate-50">Объекты</p>
          {objects.length === 0 && <p className="text-[12px] text-slate-400 px-4 py-3">Объектов нет</p>}
          {objects.map((o, i) => (
            <div key={o.id} className={`flex items-center gap-3 px-4 py-3 ${i < objects.length - 1 ? 'border-b border-slate-50' : ''}`}>
              <span className="text-[20px]">{o.icon}</span>
              <div className="flex-1 min-w-0"><p className="text-[13px] font-semibold text-slate-800 truncate">{o.name}</p><p className="text-[10px] text-slate-400 truncate">{o.address}</p></div>
              <span className="text-[11px] font-bold text-slate-600">{o.counts.newCount + o.counts.assigned + o.counts.inWork + o.counts.awaiting} заявок</span>
            </div>
          ))}
        </div>
        <div className="h-6" />
      </div>
    </div>
  )
}

export default CompanyScreen
