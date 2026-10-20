import { useMemo, useState } from 'react'

import { OperationsMap } from '../components/map/OperationsMap'
import { LocationSummaryCard } from '../components/map/LocationSummaryCard'
import { useMapLocations } from '../hooks/useMapLocations'

export function MapPage() {
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const { locationsQ, selectedLocationQ, summary } = useMapLocations(selectedLocationId)

  const locations = useMemo(() => locationsQ.data || [], [locationsQ.data])

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Service Operations Map</h2>
          <div className="muted small">Operational view of company locations with ticket activity for today.</div>
        </div>
      </div>

      {locationsQ.isError ? <div className="alert">{(locationsQ.error as any)?.message || String(locationsQ.error)}</div> : null}
      {selectedLocationQ.isError ? <div className="alert">{(selectedLocationQ.error as any)?.message || String(selectedLocationQ.error)}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 }}>
        <div className="panel"><div className="muted small">Locations</div><div style={{ fontSize: 24, fontWeight: 800 }}>{summary.totalLocations}</div></div>
        <div className="panel"><div className="muted small">Tickets today</div><div style={{ fontSize: 24, fontWeight: 800 }}>{summary.ticketsToday}</div></div>
        <div className="panel"><div className="muted small">New</div><div style={{ fontSize: 24, fontWeight: 800, color: '#d62828' }}>{summary.newCount}</div></div>
        <div className="panel"><div className="muted small">In progress</div><div style={{ fontSize: 24, fontWeight: 800, color: '#f4a261' }}>{summary.inProgressCount}</div></div>
        <div className="panel"><div className="muted small">Done</div><div style={{ fontSize: 24, fontWeight: 800, color: '#2a9d8f' }}>{summary.doneCount}</div></div>
      </div>

      {locationsQ.isLoading ? (
        <div className="panel">Loading map locations...</div>
      ) : locations.length === 0 ? (
        <div className="panel">
          <h3 style={{ marginBottom: 8 }}>No map points yet</h3>
          <div className="muted">Locations with coordinates will appear here once latitude and longitude are filled in.</div>
        </div>
      ) : (
        <div className="grid2" style={{ gridTemplateColumns: '1.5fr 0.9fr', alignItems: 'start' }}>
          <OperationsMap
            locations={locations}
            selectedLocationId={selectedLocationId}
            onSelect={setSelectedLocationId}
          />
          <LocationSummaryCard
            detail={selectedLocationQ.data}
            isLoading={selectedLocationQ.isLoading}
          />
        </div>
      )}
    </div>
  )
}