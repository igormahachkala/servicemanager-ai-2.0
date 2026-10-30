import { useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'

import './technicianMapPin.css'
import { personDisplayName, type TechnicianMapPersonRow } from './technicianMapSelection'

type Props = {
  people: TechnicianMapPersonRow[]
}

const defaultCenter: [number, number] = [55.751244, 37.618423]

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function pinIcon(person: TechnicianMapPersonRow): L.DivIcon {
  const name = escapeHtml(personDisplayName(person))
  const when = escapeHtml(person.syncedAtLabel)
  return L.divIcon({
    className: 'technician-map-pin',
    html: `<div class="technician-map-pin-card"><div>${name}</div><div>${when}</div></div>`,
    iconSize: [1, 1],
    iconAnchor: [0, 0],
  })
}

function FitPeople({ people }: { people: TechnicianMapPersonRow[] }) {
  const map = useMap()
  useEffect(() => {
    const points = people.flatMap((person) => (
      person.latitude == null || person.longitude == null ? [] : [[person.latitude, person.longitude] as [number, number]]
    ))
    if (points.length === 0) return
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 })
  }, [map, people])
  return null
}

export function TechnicianMapCanvas({ people }: Props) {
  return (
    <MapContainer center={defaultCenter} zoom={10} className="technician-map-canvas" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitPeople people={people} />
      {people.map((person) => (
        person.latitude == null || person.longitude == null ? null : (
          <Marker
            key={person.id}
            position={[person.latitude, person.longitude]}
            icon={pinIcon(person)}
          />
        )
      ))}
    </MapContainer>
  )
}
