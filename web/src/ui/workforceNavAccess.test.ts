import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const shell = () => readFileSync(resolve(here, 'Shell.tsx'), 'utf8')
const mobileSettings = () => readFileSync(resolve(here, '../mobile/MobileSettingsPage.tsx'), 'utf8')

function desktopWorkforceRule(): string {
  const source = shell()
  const at = source.indexOf("item.to === '/workforce'")
  expect(at).toBeGreaterThan(-1)
  return source.slice(at, source.indexOf('\n  }', at))
}

function mobileWorkforceRoles(): string {
  const source = mobileSettings()
  const at = source.indexOf('const WORKFORCE_ROLES')
  expect(at).toBeGreaterThan(-1)
  return source.slice(at, source.indexOf('\n', at))
}

describe('Workforce CLIENT_ADMIN navigation visibility', () => {
  it('shows desktop Workforce navigation to CLIENT_ADMIN', () => {
    expect(desktopWorkforceRule()).toContain("'CLIENT_ADMIN'")
  })

  it('shows mobile Workforce settings entry to CLIENT_ADMIN', () => {
    expect(mobileWorkforceRoles()).toContain("'CLIENT_ADMIN'")
  })

  it('does not expose Workforce navigation to non-management roles', () => {
    const desktopRule = desktopWorkforceRule()
    const mobileRoles = mobileWorkforceRoles()
    for (const forbidden of ["'CLIENT'", "'TECHNICIAN'", "'STAFF'"]) {
      expect(desktopRule).not.toContain(forbidden)
      expect(mobileRoles).not.toContain(forbidden)
    }
  })

  it('keeps existing Workforce navigation roles visible', () => {
    const desktopRule = desktopWorkforceRule()
    const mobileRoles = mobileWorkforceRoles()
    for (const role of ['ADMIN', 'MASTER', 'DISPATCHER', 'NETWORK_DIRECTOR', 'TERRITORIAL_MANAGER']) {
      expect(desktopRule).toContain(`'${role}'`)
      expect(mobileRoles).toContain(`'${role}'`)
    }
  })
})
