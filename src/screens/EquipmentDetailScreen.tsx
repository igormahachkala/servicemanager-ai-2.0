import { IconChevronLeft } from '@tabler/icons-react'
import * as api from '../api/client'
import { equipmentFromApi } from '../api/mappers'

function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()}`
}

// Детальная карточка единицы оборудования (GET /equipment/:id — те же поля).
export function EquipmentDetailScreen({ equipment, onBack }: { equipment: api.Equipment; onBack: () => void }) {
  const e = equipmentFromApi(equipment)
  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: 'Тип', value: e.typeLabel },
    { label: 'Локация', value: e.location?.name ?? '—' },
    { label: 'Код объекта', value: e.location?.platformCode ? <span className="font-mono">{e.location.platformCode}</span> : '—' },
    { label: 'Город', value: e.location?.city ?? '—' },
    { label: 'Добавлено', value: fmtDate(e.createdAt) },
    { label: 'ID', value: <span className="font-mono text-[11px] text-slate-400">{e.id}</span> },
  ]
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="bg-white border-b border-slate-100 flex-shrink-0 flex items-center gap-2 px-3 py-2.5">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 active:bg-slate-200"><IconChevronLeft size={18} className="text-slate-700" /></button>
        <h1 className="text-[15px] font-bold text-slate-900 truncate">{e.name}</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50 flex flex-col gap-3" style={{ scrollbarWidth: 'none' }}>
        {/* Заголовок со статусом + акцент-бар */}
        <div className={`bg-white rounded-2xl border border-slate-200 border-l-4 shadow-sm p-4 ${e.statusAccent}`}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[16px] font-bold text-slate-900">{e.name}</p>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${e.statusBadge}`}>{e.statusLabel}</span>
          </div>
          <p className="text-[12px] text-slate-400 mt-0.5">{e.typeLabel}</p>
        </div>

        {/* Реальные поля */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {rows.map((r, i) => (
            <div key={r.label} className={`flex items-center justify-between gap-3 px-4 py-3 ${i < rows.length - 1 ? 'border-b border-slate-50' : ''}`}>
              <span className="text-[12px] text-slate-400">{r.label}</span>
              <span className="text-[13px] font-semibold text-slate-800 text-right truncate">{r.value}</span>
            </div>
          ))}
        </div>

        {/* TODO: полей нет в API */}
        <div className="bg-slate-100 rounded-2xl px-4 py-3">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Нет в API</p>
          <p className="text-[12px] text-slate-400 leading-relaxed">
            {/* TODO: serial, model, manufacturer — нет в API */}
            Серийный номер, модель, производитель, гарантия, QR-код — backend-модель Equipment их не содержит.
          </p>
        </div>
      </div>
    </div>
  )
}

export default EquipmentDetailScreen
