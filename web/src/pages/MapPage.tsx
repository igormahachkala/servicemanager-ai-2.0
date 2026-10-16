import { useMemo, useState, lazy, Suspense } from 'react'

import { LocationSummaryCard } from '../components/map/LocationSummaryCard'
import { useMapLocations } from '../hooks/useMapLocations'

const OperationsMap = lazy(() =>
  import('../components/map/OperationsMap').then((m) => ({ default: m.OperationsMap })),
)

export function MapPage() {
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const { locationsQ, selectedLocationQ, summary } = useMapLocations(selectedLocationId)

  const locations = useMemo(() => locationsQ.data || [], [locationsQ.data])

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Карта операций</h2>
          <div className="muted small">Точки компании и активность по заявкам за сегодня.</div>
        </div>
      </div>

      {locationsQ.isError ? <div className="alert">{(locationsQ.error as any)?.message || String(locationsQ.error)}</div> : null}
      {selectedLocationQ.isError ? <div className="alert">{(selectedLocationQ.error as any)?.message || String(selectedLocationQ.error)}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 }}>
        <div className="panel"><div className="muted small">Точки</div><div style={{ fontSize: 24, fontWeight: 800 }}>{summary.totalLocations}</div></div>
        <div className="panel"><div className="muted small">Заявок за сегодня</div><div style={{ fontSize: 24, fontWeight: 800 }}>{summary.ticketsToday}</div></div>
        <div className="panel"><div className="muted small">Новые</div><div style={{ fontSize: 24, fontWeight: 800, color: '#d62828' }}>{summary.newCount}</div></div>
        <div className="panel"><div className="muted small">В работе</div><div style={{ fontSize: 24, fontWeight: 800, color: '#f4a261' }}>{summary.inProgressCount}</div></div>
        <div className="panel"><div className="muted small">Выполнено</div><div style={{ fontSize: 24, fontWeight: 800, color: '#2a9d8f' }}>{summary.doneCount}</div></div>
      </div>

      {locationsQ.isLoading ? (
        <div className="panel">Загружаем точки на карте…</div>
      ) : locations.length === 0 ? (
        <div className="panel">
          <h3 style={{ marginBottom: 8 }}>Точек на карте пока нет</h3>
          <div className="muted">Точки появятся здесь, когда у них будут заполнены широта и долгота.</div>
        </div>
      ) : (
        <div className="grid2" style={{ gridTemplateColumns: '1.5fr 0.9fr', alignItems: 'start' }}>
          <Suspense fallback={<div className="panel">Загружаем точки на карте…</div>}>
            <OperationsMap
              locations={locations}
              selectedLocationId={selectedLocationId}
              onSelect={setSelectedLocationId}
            />
          </Suspense>
          <LocationSummaryCard
            detail={selectedLocationQ.data}
            isLoading={selectedLocationQ.isLoading}
          />
        </div>
      )}
    </div>
  )
}
