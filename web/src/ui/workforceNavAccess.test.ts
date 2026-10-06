import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const shell = () => readFileSync(resolve(here, 'Shell.tsx'), 'utf8')
const navigation = () => readFileSync(resolve(here, '../lib/navigation.ts'), 'utf8')
const mobileSettings = () => readFileSync(resolve(here, '../mobile/MobileSettingsPage.tsx'), 'utf8')

/**
 * Примирение с Navigation V2.
 *
 * Прежняя редакция читала из Shell.tsx правило `item.to === '/workforce'`.
 * Navigation V2 это правило из Shell убрал: видимость решает общая чистая
 * функция в lib/navigation.ts, Shell её только применяет. Поэтому проверки
 * по исходнику Shell стали невыполнимыми (строки там больше нет).
 *
 * Состав РОЛЕЙ десктопного пункта здесь намеренно НЕ проверяется: он теперь
 * принадлежит Navigation V2 и покрыт его собственным набором
 * (lib/managementNavigationV2.test.ts). Там зафиксировано, что CLIENT_ADMIN
 * десктопный пункт /workforce НЕ видит — решение владельца, пока `me` не
 * подтверждает WORKFORCE_VIEW. Дублировать это здесь значило бы закрепить
 * сторону вопроса, который владелец ещё не закрыл.
 *
 * Мобильный вход — отдельный гейт, Navigation V2 его не трогал, и он
 * остаётся предметом этой проверки.
 */

function mobileWorkforceRoles(): string {
  const source = mobileSettings()
  const at = source.indexOf('const WORKFORCE_ROLES')
  expect(at).toBeGreaterThan(-1)
  return source.slice(at, source.indexOf('\n', at))
}

describe('Workforce CLIENT_ADMIN navigation visibility', () => {
  it('mobile Workforce entry is available to CLIENT_ADMIN', () => {
    expect(mobileWorkforceRoles()).toContain("'CLIENT_ADMIN'")
  })

  it('mobile Workforce entry stays closed to non-management roles', () => {
    const mobileRoles = mobileWorkforceRoles()
    for (const forbidden of ["'CLIENT'", "'TECHNICIAN'", "'STAFF'"]) {
      expect(mobileRoles).not.toContain(forbidden)
    }
  })

  it('mobile Workforce entry keeps the existing management roles', () => {
    const mobileRoles = mobileWorkforceRoles()
    for (const role of ['ADMIN', 'MASTER', 'DISPATCHER', 'NETWORK_DIRECTOR', 'TERRITORIAL_MANAGER']) {
      expect(mobileRoles).toContain(`'${role}'`)
    }
  })

  it('desktop visibility is delegated to the shared navigation gate', () => {
    /*
     * Проводка, а не состав ролей: если Shell снова начнёт решать видимость
     * сам, решение разъедется с Navigation V2 и его набором.
     */
    const shellSource = shell()
    expect(shellSource).toContain('isManagementNavItemVisible(item.to')
    expect(shellSource).not.toContain("item.to === '/workforce'")

    // Гейт действительно живёт в общей функции и её наборе.
    expect(navigation()).toContain('isManagementNavItemVisible')
  })
})
