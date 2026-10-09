import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Контракт read-only доступа CLIENT_ADMIN к Workforce на БЭКЕНДЕ.
 * Фронтенд не является security boundary: решают @Roles (role guard) +
 * @RequirePermission (PermissionsGuard читает RolePermission из БД).
 *
 * CLIENT_ADMIN допускается ТОЛЬКО к @Get-ручкам под WORKFORCE_VIEW и ни к одной
 * мутации (@Post/@Put/@Patch/@Delete). Если роль просочится в write-ручку —
 * тест падает (negative control на уровне маршрутов).
 */
const controller = readFileSync(resolve(__dirname, 'workforce.controller.ts'), 'utf8')

// Режем файл на блоки по HTTP-декораторам: блок = от одного @Get/@Post/... до следующего.
const httpDecorator = /@(Get|Post|Put|Patch|Delete)\(/g
function methodBlocks(src: string) {
  const starts: { verb: string; idx: number }[] = []
  let m: RegExpExecArray | null
  while ((m = httpDecorator.exec(src))) starts.push({ verb: m[1], idx: m.index })
  return starts.map((s, i) => ({
    verb: s.verb,
    body: src.slice(s.idx, i + 1 < starts.length ? starts[i + 1].idx : src.length),
  }))
}

describe('Workforce CLIENT_ADMIN read-only route contract', () => {
  const blocks = methodBlocks(controller)

  it('exposes exactly two CLIENT_ADMIN endpoints', () => {
    const withClientAdmin = blocks.filter((b) => b.body.includes('UserRole.CLIENT_ADMIN'))
    expect(withClientAdmin).toHaveLength(2)
  })

  it('grants CLIENT_ADMIN only on GET endpoints gated by WORKFORCE_VIEW', () => {
    for (const b of blocks) {
      if (!b.body.includes('UserRole.CLIENT_ADMIN')) continue
      expect(b.verb).toBe('Get')
      expect(b.body).toContain('@RequirePermission(PERMISSIONS.WORKFORCE_VIEW)')
    }
  })

  it('NEVER grants CLIENT_ADMIN on a mutating endpoint (create/update/delete)', () => {
    const writeVerbs = new Set(['Post', 'Put', 'Patch', 'Delete'])
    const leaked = blocks.filter(
      (b) => writeVerbs.has(b.verb) && b.body.includes('UserRole.CLIENT_ADMIN'),
    )
    expect(leaked).toHaveLength(0)
  })

  it('covers the two canonical read endpoints (shift list + shift detail)', () => {
    expect(controller).toMatch(/@Get\('shifts'\)[\s\S]*?UserRole\.CLIENT_ADMIN[\s\S]*?WORKFORCE_VIEW/)
    expect(controller).toMatch(/@Get\('shifts\/:shiftId'\)[\s\S]*?UserRole\.CLIENT_ADMIN[\s\S]*?WORKFORCE_VIEW/)
  })
})
