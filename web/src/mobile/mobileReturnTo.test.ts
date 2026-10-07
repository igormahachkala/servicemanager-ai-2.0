import { describe, expect, it } from 'vitest'

import { mobileReturnToState, resolveMobileReturnTo } from './mobileReturnTo'

const home = '/m'

describe('resolveMobileReturnTo', () => {
  it('без returnTo ведёт на запасной адрес', () => {
    expect(resolveMobileReturnTo({ pathname: '/m/materials', returnTo: undefined, fallback: home })).toBe(home)
    expect(resolveMobileReturnTo({ pathname: '/m/materials', returnTo: null, fallback: home })).toBe(home)
    expect(resolveMobileReturnTo({ pathname: '/m/materials', returnTo: 1, fallback: home })).toBe(home)
    expect(resolveMobileReturnTo({ pathname: '/m/materials', returnTo: '', fallback: home })).toBe(home)
  })

  it('отклоняет чужой корень, внешний адрес и текущую страницу', () => {
    expect(resolveMobileReturnTo({ pathname: '/m/materials', returnTo: 'https://evil.test/m', fallback: home })).toBe(home)
    expect(resolveMobileReturnTo({ pathname: '/m/materials', returnTo: '//evil.test/m', fallback: home })).toBe(home)
    expect(resolveMobileReturnTo({ pathname: '/m/materials', returnTo: '/board', fallback: home })).toBe(home)
    expect(resolveMobileReturnTo({ pathname: '/m/materials', returnTo: '/max/profile', fallback: home })).toBe(home)
    expect(resolveMobileReturnTo({ pathname: '/m/materials', returnTo: '/m/materials', fallback: home })).toBe(home)
    expect(resolveMobileReturnTo({ pathname: '/m/materials', returnTo: '/m/materials?companyId=a', fallback: home })).toBe(home)
    expect(resolveMobileReturnTo({ pathname: '/max/profile', returnTo: '/m/my', fallback: '/max' })).toBe('/max')
  })

  it('принимает путь того же корня и сохраняет query', () => {
    expect(resolveMobileReturnTo({
      pathname: '/m/materials',
      returnTo: '/m/my?linkedClientCompanyId=abc',
      fallback: home,
    })).toBe('/m/my?linkedClientCompanyId=abc')
    expect(resolveMobileReturnTo({ pathname: '/m/settings', returnTo: '/m', fallback: home })).toBe('/m')
    expect(resolveMobileReturnTo({ pathname: '/max/settings', returnTo: '/max/profile?companyId=1#x', fallback: '/max' })).toBe('/max/profile?companyId=1')
  })
})

describe('mobileReturnToState', () => {
  it('склеивает путь и query открытого экрана', () => {
    expect(mobileReturnToState('/m/my', '?companyId=1')).toEqual({ returnTo: '/m/my?companyId=1' })
    expect(mobileReturnToState('/m', '')).toEqual({ returnTo: '/m' })
  })
})
