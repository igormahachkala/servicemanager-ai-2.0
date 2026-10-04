import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * SMA-WORKFORCE-CLIENT-ADMIN-FRESH-RECONCILIATION-122F.
 *
 * Видимость пункта «Смены и трудозатраты» — это UX, а не доступ: решение
 * принимает бэкенд пересечением перечня ролей, шлюза управления и права
 * WORKFORCE_VIEW (см. workforce-client-admin-parity.spec.ts). Здесь
 * проверяется только одно: интерфейс не расходится с этим решением и роль,
 * которой раздел открыт, видит на него ссылку, а не упирается в пустоту.
 *
 * Правило живёт внутри Shell.tsx и наружу не экспортируется, поэтому
 * проверяется исходник. Экспортировать его ради теста значило бы менять
 * архитектуру навигации, а эта задача узкая.
 */
const shell = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'Shell.tsx'), 'utf8')

function workforceNavRule(): string {
  const at = shell.indexOf("item.to === '/workforce'")
  expect(at).toBeGreaterThan(-1)
  return shell.slice(at, shell.indexOf('\n  }', at))
}

describe('122F навигация Workforce', () => {
  it('CLIENT_ADMIN видит раздел «Смены и трудозатраты»', () => {
    expect(workforceNavRule()).toContain("'CLIENT_ADMIN'")
  })

  it('роли, которым раздел закрыт, в правиле не появились', () => {
    const rule = workforceNavRule()
    // TECHNICIAN и обычный CLIENT доступа не имеют — и ссылки видеть не должны.
    expect(rule).not.toContain("'TECHNICIAN'")
    expect(rule).not.toMatch(/===\s*'CLIENT'/)
    expect(rule).not.toContain("'STAFF'")
  })

  it('прежние управленческие роли из правила не пропали', () => {
    const rule = workforceNavRule()
    for (const role of ['ADMIN', 'MASTER', 'DISPATCHER', 'NETWORK_DIRECTOR', 'TERRITORIAL_MANAGER']) {
      expect(rule).toContain(`'${role}'`)
    }
  })
})
