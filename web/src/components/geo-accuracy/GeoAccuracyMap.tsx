import { useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Popup, Rectangle, TileLayer, Tooltip, useMap } from 'react-leaflet'

import {
  GEO_ACCURACY_BUCKET_KEYS,
  GEO_ACCURACY_LABEL,
  GEO_ACCURACY_RANGE_COLOR,
  GEO_ACCURACY_RANGE_KEYS,
  cellKey,
  dominantRangeKey,
  isRangeSwitchedOff,
  type GeoAccuracyCellView,
  type GeoAccuracyRangeKey,
} from './geoAccuracyModel'

type Props = {
  companyId: string
  cells: GeoAccuracyCellView[]
  enabled: ReadonlySet<GeoAccuracyRangeKey>
  loading: boolean
  failed: boolean
  selectedKey: string | null
  onSelect: (cell: GeoAccuracyCellView) => void
}

const defaultCenter: [number, number] = [55.751244, 37.618423]
const noCells: GeoAccuracyCellView[] = []

function FitCells({ cells }: { cells: GeoAccuracyCellView[] }) {
  const map = useMap()

  useEffect(() => {
    if (cells.length === 0) return
    const bounds = L.latLngBounds(
      cells.flatMap((cell) => [
        [cell.bounds.south, cell.bounds.west] as [number, number],
        [cell.bounds.north, cell.bounds.east] as [number, number],
      ]),
    )
    if (!bounds.isValid()) return
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 })
  }, [map, cells])

  return null
}

function mapStatus(companyId: string, cells: GeoAccuracyCellView[], loading: boolean, failed: boolean) {
  if (!companyId) return 'Компания провайдера не выбрана. Прямоугольников нет.'
  if (loading) return 'Считаем клетки выбранной компании.'
  if (failed) return 'Клетки не загрузились.'
  if (cells.length === 0) return 'У выбранной компании клеток нет.'
  return 'Клик по клетке показывает все диапазоны и число без точности. Подсказка показывает только включённые диапазоны.'
}

export function GeoAccuracyMap({ companyId, cells, enabled, loading, failed, selectedKey, onSelect }: Props) {
  const visibleCells = companyId ? cells : noCells

  return (
    <section className="panel" style={{ padding: 0, overflow: 'hidden' }} aria-label="Карта точности">
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #e5e7eb' }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Карта</h2>
        <div className="muted small">{mapStatus(companyId, visibleCells, loading, failed)}</div>
      </div>
      <MapContainer center={defaultCenter} zoom={5} style={{ height: 480, width: '100%' }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitCells cells={visibleCells} />
        {visibleCells.map((cell) => {
          const id = cellKey(cell.bounds)
          const dominant = dominantRangeKey(cell.counts, enabled)
          const fill = dominant ? GEO_ACCURACY_RANGE_COLOR[dominant] : null
          const selected = selectedKey === id
          const enabledKeys = GEO_ACCURACY_RANGE_KEYS.filter((key) => enabled.has(key))
          return (
            <Rectangle
              key={id}
              bounds={[
                [cell.bounds.south, cell.bounds.west],
                [cell.bounds.north, cell.bounds.east],
              ] as [[number, number], [number, number]]}
              pathOptions={{
                color: selected ? '#111827' : fill ?? '#94a3b8',
                weight: selected ? 2 : 1,
                fillColor: fill ?? '#94a3b8',
                fillOpacity: fill ? 0.55 : 0.02,
              }}
              eventHandlers={{ click: () => onSelect(cell) }}
            >
              {enabledKeys.length > 0 ? (
                <Tooltip>
                  <div style={{ minWidth: 120 }}>
                    {enabledKeys.map((key) => (
                      <div key={key}>
                        {GEO_ACCURACY_LABEL[key]} {cell.counts[key].toLocaleString('ru-RU')}
                      </div>
                    ))}
                  </div>
                </Tooltip>
              ) : null}
              <Popup>
                <div style={{ minWidth: 160 }}>
                  {GEO_ACCURACY_BUCKET_KEYS.map((key) => {
                    const switchedOff = isRangeSwitchedOff(key, enabled)
                    return (
                      <div key={key}>
                        {GEO_ACCURACY_LABEL[key]} {cell.counts[key].toLocaleString('ru-RU')}
                        {switchedOff ? ' выключен' : ''}
                      </div>
                    )
                  })}
                </div>
              </Popup>
            </Rectangle>
          )
        })}
      </MapContainer>
    </section>
  )
}
