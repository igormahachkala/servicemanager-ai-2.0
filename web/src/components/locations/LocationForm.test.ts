import { describe, expect, it } from 'vitest'

import {
  ADDRESS_SUGGEST_DEBOUNCE_MS,
  parseCityFromSuggestFullName,
  shouldRequestAddressSuggest,
} from './LocationForm'

describe('shouldRequestAddressSuggest', () => {
  it('starts after two non-space characters', () => {
    expect(shouldRequestAddressSuggest('')).toBe(false)
    expect(shouldRequestAddressSuggest('л')).toBe(false)
    expect(shouldRequestAddressSuggest('ле')).toBe(true)
    expect(shouldRequestAddressSuggest('  ле  ')).toBe(true)
  })

  it('does not request again for the address just picked from suggestions', () => {
    expect(shouldRequestAddressSuggest('Советский проспект, 54', 'Советский проспект, 54')).toBe(false)
    expect(shouldRequestAddressSuggest(' Советский проспект, 54 ', 'Советский проспект, 54')).toBe(false)
    expect(shouldRequestAddressSuggest('Советский проспект, 5', 'Советский проспект, 54')).toBe(true)
    expect(shouldRequestAddressSuggest('Советский проспект, 54', null)).toBe(true)
  })
})

describe('parseCityFromSuggestFullName', () => {
  it('takes city from a 2GIS fullName and leaves street/house out', () => {
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
  it('waits at least 300ms', () => {
    expect(ADDRESS_SUGGEST_DEBOUNCE_MS).toBeGreaterThanOrEqual(300)
  })
})
