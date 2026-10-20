import { useEffect, useRef, useState } from 'react'

import {
  suggestCoordsFromItem,
  suggestLocationAddress,
  type LocationAddressSuggestItem,
} from '../../lib/locationGeocodeApi'

export type LocationFormValue = {
  pointNumber: string
  name: string
  city: string
  address: string
  isActive: boolean
  /** Coords from an accepted Dadata suggest pick. Not shown as fields. */
  latitude?: number
  longitude?: number
}

type Props = {
  title: string
  submitLabel: string
  value: LocationFormValue
  submitting?: boolean
  error?: string | null
  onChange: (patch: Partial<LocationFormValue>) => void
  onSubmit: (event: React.FormEvent) => void
  onCancel?: () => void
}

export const ADDRESS_SUGGEST_DEBOUNCE_MS = 600

const STREET_HINT =
  /(улица|^ул\.|проспект|пр-кт|переулок|^пер\.|шоссе|бульвар|набережная|площадь|проезд|тупик|микрорайон|^мкр)/i
const REGION_HINT = /(область|край|республика|округ|район)/i
const COUNTRY_HINT = /^(россия|российская федерация)$/i
const HOUSE_HINT = /^\d+[а-яa-z]?(\/\d+)?$/i

export function shouldRequestAddressSuggest(typedQuery: string | null) {
  return typedQuery !== null && typedQuery.trim().length >= 2
}

export function parseCityFromSuggestFullName(fullName: string): string | null {
  const parts = fullName
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  const leftover: string[] = []
  for (const part of parts) {
    if (COUNTRY_HINT.test(part)) continue
    if (REGION_HINT.test(part)) continue
    if (STREET_HINT.test(part)) continue
    if (HOUSE_HINT.test(part)) continue
    leftover.push(part.replace(/^г\.?\s+/i, '').trim())
  }
  return leftover[0] || null
}

export function LocationForm({
  title,
  submitLabel,
  value,
  submitting,
  error,
  onChange,
  onSubmit,
  onCancel,
}: Props) {
  const [suggestions, setSuggestions] = useState<LocationAddressSuggestItem[]>([])
  const [suggestOpen, setSuggestOpen] = useState(false)
  const requestSeq = useRef(0)
  // Only text typed into the address field triggers suggestions; values loaded into the form do not.
  const [typedAddress, setTypedAddress] = useState<string | null>(null)
  const addressQuery = typedAddress !== null && typedAddress === value.address ? typedAddress : null

  useEffect(() => {
    if (submitting || !shouldRequestAddressSuggest(addressQuery)) {
      requestSeq.current += 1
      setSuggestions([])
      setSuggestOpen(false)
      return
    }

    const seq = ++requestSeq.current
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void suggestLocationAddress(addressQuery!, value.city, controller.signal)
        .then((items) => {
          if (seq !== requestSeq.current) return
          setSuggestions(items)
          setSuggestOpen(items.length > 0)
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return
          if (seq !== requestSeq.current) return
          setSuggestions([])
          setSuggestOpen(false)
          void err
        })
    }, ADDRESS_SUGGEST_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [addressQuery, value.city, submitting])

  function pickSuggestion(item: LocationAddressSuggestItem) {
    const cityFromItem = (item.city || '').trim() || parseCityFromSuggestFullName(item.fullName)
    const coords = suggestCoordsFromItem(item)
    setTypedAddress(null)
    requestSeq.current += 1
    onChange({
      address: item.text,
      ...(cityFromItem ? { city: cityFromItem } : {}),
      ...(coords
        ? { latitude: coords.latitude, longitude: coords.longitude }
        : { latitude: undefined, longitude: undefined }),
    })
    setSuggestions([])
    setSuggestOpen(false)
  }

  return (
    <form onSubmit={onSubmit} className="form">
      <h3 style={{ marginBottom: 10 }}>{title}</h3>

      <label>
        Номер точки
        <input
          value={value.pointNumber}
          onChange={(e) => onChange({ pointNumber: e.target.value })}
          placeholder="001"
          disabled={submitting}
        />
      </label>

      <label>
        Название
        <input
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Точка на Ленина"
          disabled={submitting}
        />
      </label>

      <label>
        Город
        <input
          value={value.city}
          onChange={(e) => onChange({ city: e.target.value })}
          placeholder="Екатеринбург"
          disabled={submitting}
        />
      </label>

      <label>
        Адрес
        <div style={{ position: 'relative' }}>
          <input
            value={value.address}
            onChange={(e) => {
              setTypedAddress(e.target.value)
              onChange({
                address: e.target.value,
                latitude: undefined,
                longitude: undefined,
              })
            }}
            placeholder="ул. Ленина, 1"
            disabled={submitting}
            autoComplete="off"
            onFocus={() => {
              if (suggestions.length > 0) setSuggestOpen(true)
            }}
            onBlur={() => {
              window.setTimeout(() => setSuggestOpen(false), 120)
            }}
          />
          {suggestOpen && suggestions.length > 0 ? (
            <ul
              style={{
                position: 'absolute',
                zIndex: 8,
                left: 0,
                right: 0,
                margin: 0,
                padding: 4,
                listStyle: 'none',
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                maxHeight: 220,
                overflow: 'auto',
                boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
              }}
            >
              {suggestions.map((item, index) => (
                <li key={`${item.fullName}-${index}`}>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      pickSuggestion(item)
                    }}
                    style={{
                      width: '100%',
                      height: 'auto',
                      minHeight: 38,
                      textAlign: 'left',
                      background: 'transparent',
                      color: '#111827',
                      border: 0,
                      borderRadius: 8,
                      padding: '8px 10px',
                    }}
                  >
                    <div>{item.text}</div>
                    {item.fullName && item.fullName !== item.text ? (
                      <div className="muted small">{item.fullName}</div>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </label>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={value.isActive}
          onChange={(e) => onChange({ isActive: e.target.checked })}
          disabled={submitting}
        />
        <span>Локация активна</span>
      </label>

      {error ? (
        <div className="alert" role="alert" style={{ marginTop: 0 }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 8 }}>
        <button disabled={submitting}>{submitting ? 'Сохраняем...' : submitLabel}</button>
        {onCancel ? (
          <button type="button" className="ghost" onClick={onCancel} disabled={submitting}>
            Отмена
          </button>
        ) : null}
      </div>
    </form>
  )
}
