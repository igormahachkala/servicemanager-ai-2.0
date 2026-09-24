import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, TileLayer, Tooltip } from 'react-leaflet'

import * as api from '../../lib/api'

type Props = {
  locations: api.MapLocationItem[]
  selectedLocationId: string | null
  onSelect: (locationId: string) => void
}

const defaultCenter: [number, number] = [55.751244, 37.618423]

function markerColor(status: api.MapDominantStatus) {
  if (status === 'NEW') return '#d62828'
  if (status === 'IN_PROGRESS') return '#f4a261'
  if (status === 'DONE') return '#2a9d8f'
  return '#6c757d'
}

function createStatusIcon(status: api.MapDominantStatus, selected: boolean) {
  const color = markerColor(status)
  const size = selected ? 24 : 18

  return L.divIcon({
    className: 'operations-map-marker',
    html: `<div style="width:${size}px;height:${size}px;border-radius:999px;background:${color};border:3px solid white;box-shadow:0 6px 14px rgba(0,0,0,.24);"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export function OperationsMap({ locations, selectedLocationId, onSelect }: Props) {
  const center: [number, number] = locations.length > 0
    ? [locations[0].latitude, locations[0].longitude]
    : defaultCenter

  return (
    <div className="panel" style={{ padding: 0, overflow: 'hidden', minHeight: 480 }}>
      <MapContainer center={center} zoom={5} style={{ height: 480, width: '100%' }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {locations.map((location) => (
          <Marker
            key={location.locationId}
            position={[location.latitude, location.longitude]}
            icon={createStatusIcon(location.dominantStatus, selectedLocationId === location.locationId)}
            eventHandlers={{ click: () => onSelect(location.locationId) }}
          >
            <Tooltip>
              <div style={{ minWidth: 180 }}>
                <div style={{ fontWeight: 700 }}>{location.name}</div>
                <div>{location.address || 'Address not specified'}</div>
                <div style={{ marginTop: 6 }}>Tickets today: {location.ticketsToday}</div>
              </div>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}