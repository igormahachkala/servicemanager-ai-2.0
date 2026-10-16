import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { canManageWorkforceSettings } from './workforceSettingsAccess'

describe('Workforce settings access', () => {
  it('allows only a provider-contour ADMIN', () => {
    expect(canManageWorkforceSettings({ role: 'ADMIN', companyType: 'PROVIDER' })).toBe(true)
  })

  it.each([
    ['ADMIN', 'CLIENT'],
    ['CLIENT_ADMIN', 'CLIENT'],
    ['CLIENT', 'CLIENT'],
    ['TECHNICIAN', 'PROVIDER'],
    ['DISPATCHER', 'PROVIDER'],
    ['PLATFORM_ADMIN', null],
  ] as const)('denies %s in %s according to the current backend policy', (role, companyType) => {
    expect(canManageWorkforceSettings({ role, companyType })).toBe(false)
  })

  it('fails closed while the company contour is unresolved', () => {
    expect(canManageWorkforceSettings({ role: 'ADMIN', companyType: null })).toBe(false)
  })

  it('guards the Workforce write controls with the canonical predicate', () => {
    const page = readFileSync(new URL('../views/WorkforcePage.tsx', import.meta.url), 'utf8')

    expect(page).toContain('canManageWorkforceSettings({')
    expect(page).toContain('{canManageSettings ? (')
    expect(page).not.toMatch(/meQ\.data\?\.role\s*===\s*['"]ADMIN['"]/)
  })
})
