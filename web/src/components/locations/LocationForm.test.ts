import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  ADDRESS_SUGGEST_DEBOUNCE_MS,
  LocationForm,
  parseCityFromSuggestFullName,
  shouldRequestAddressSuggest,
} from './LocationForm'
import { isAcceptedSuggestQcGeo, suggestCoordsFromItem } from '../../lib/locationGeocodeApi'

function renderForm(error?: string | null) {
  return renderToStaticMarkup(
    createElement(LocationForm, {
      title: 'Редактировать',
      submitLabel: 'Сохранить',
      value: { pointNumber: '', name: 'Точка', city: '', address: '', isActive: true },
      error,
      onChange: () => {},
      onSubmit: () => {},
    }),
  )
}

describe('LocationForm error', () => {
  it('shows the save error inside the form, before the submit button', () => {
    const html = renderForm('Location not found')
    const alertAt = html.indexOf('role="alert"')
    expect(alertAt).toBeGreaterThan(-1)
    expect(html).toContain('Location not found')
    expect(alertAt).toBeLessThan(html.indexOf('Сохранить</button>'))
  })

  it('renders no alert without an error', () => {
    expect(renderForm(null)).not.toContain('role="alert"')
    expect(renderForm()).not.toContain('role="alert"')
  })
})

describe('shouldRequestAddressSuggest', () => {
  it('starts after two non-space characters', () => {
    expect(shouldRequestAddressSuggest('')).toBe(false)
    expect(shouldRequestAddressSuggest('л')).toBe(false)
    expect(shouldRequestAddressSuggest('ле')).toBe(true)
    expect(shouldRequestAddressSuggest('  ле  ')).toBe(true)
  })

  it('does not request without text typed into the address field', () => {
    expect(shouldRequestAddressSuggest(null)).toBe(false)
  })
})

describe('parseCityFromSuggestFullName', () => {
  it('takes city from a Dadata fullName and leaves street/house out', () => {
    expect(
      parseCityFromSuggestFullName('Россия, Свердловская область, Екатеринбург, улица Ленина, 1'),
    ).toBe('Екатеринбург')
    expect(parseCityFromSuggestFullName('Россия, Москва, улица Тверская, 1')).toBe('Москва')
    expect(parseCityFromSuggestFullName('г. Новосибирск, Красный проспект, 10')).toBe('Новосибирск')
  })

  it('returns null when city cannot be parsed', () => {
    expect(parseCityFromSuggestFullName('улица Ленина, 1')).toBeNull()
    expect(parseCityFromSuggestFullName('')).toBeNull()
  })
})

describe('address suggest debounce', () => {
  it('waits 600ms to save the Dadata daily suggest limit', () => {
    expect(ADDRESS_SUGGEST_DEBOUNCE_MS).toBe(600)
  })
})

describe('suggest coords from Dadata pick', () => {
  it('accepts qc_geo 0 and 1 with lat/lon', () => {
    expect(isAcceptedSuggestQcGeo(0)).toBe(true)
    expect(isAcceptedSuggestQcGeo(1)).toBe(true)
    expect(isAcceptedSuggestQcGeo(2)).toBe(false)
    expect(
      suggestCoordsFromItem({
        text: 'ул Ленина, 1',
        fullName: 'г Екатеринбург, ул Ленина, д 1',
        latitude: 56.8,
        longitude: 60.6,
        qcGeo: 0,
      }),
    ).toEqual({ latitude: 56.8, longitude: 60.6 })
    expect(
      suggestCoordsFromItem({
        text: 'ул Ленина, 1',
        fullName: 'г Екатеринбург, ул Ленина, д 1',
        latitude: 56.8,
        longitude: 60.6,
        qcGeo: 2,
      }),
    ).toBeNull()
  })
})
