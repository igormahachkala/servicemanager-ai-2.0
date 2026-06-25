import { useState, useEffect, useCallback } from 'react'
import { IconChevronLeft, IconChevronRight, IconTool } from '@tabler/icons-react'
import * as api from '../api/client'
import { equipmentFromApi, type DisplayEquipment } from '../api/mappers'

// Экран списка оборудования по локации (GET /equipment/location/:locationId).
export function EquipmentScreen({ locationId, locationName, onBack, onOpenDetail }: {
  locationId: string
  locationName?: string
  onBack: () => void
  onOpenDetail: (e: api.Equipment) => void
}) {
  const [items, setItems] = useState<api.Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const r = await api.getEquipmentByLocation(locationId)
      setItems(Array.isArray(r) ? r : [])
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить оборудование')
    } finally {
      setLoading(false)
    }
  }, [locationId])
  useEffect(() => { load() }, [load])

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="bg-white border-b border-slate-100 flex-shrink-0 flex items-center gap-2 px-3 py-2.5">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 active:bg-slate-200"><IconChevronLeft size={18} className="text-slate-700" /></button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[15px] font-bold text-slate-900 leading-tight">Оборудование</h1>
          {locationName && <p className="text-[11px] text-slate-400 truncate">{locationName}</p>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50" style={{ scrollbarWidth: 'none' }}>
        {loading && <div className="flex flex-col items-center gap-2 py-12"><span className="text-[28px] animate-pulse">⏳</span><p className="text-[13px] text-slate-500">Загрузка…</p></div>}

        {error && !loading && (
          <div className="flex flex-col items-center gap-3 py-10">
            <span className="text-[36px]">⚠️</span>
            <p className="text-[13px] text-slate-600 text-center px-6">{error}</p>
            <button onClick={load} className="text-[12px] font-bold text-white bg-blue-600 px-4 py-2 rounded-xl">Повторить</button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-14">
            <IconTool size={40} className="text-slate-300" />
            <p className="text-[13px] text-slate-500">Оборудование не найдено</p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {items.map(equipmentFromApi).map((e: DisplayEquipment) => (
              <button
                key={e.id}
                onClick={() => onOpenDetail(items.find(i => i.id === e.id)!)}
                className={`bg-white rounded-2xl border border-slate-200 border-l-4 shadow-sm p-3.5 text-left active:scale-[0.99] transition-transform ${e.statusAccent}`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-[13px] font-bold text-slate-800 truncate">{e.name}</p>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${e.statusBadge}`}>{e.statusLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-slate-400 truncate">{e.typeLabel} · {e.location?.name}</p>
                  <IconChevronRight size={16} className="text-slate-300 flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default EquipmentScreen
