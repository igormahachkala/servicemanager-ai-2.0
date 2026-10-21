import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

/**
 * SMA-SHIFT-LABOR-LEDGER-INTEGRITY-106B — guard for an invariant Prisma cannot express.
 *
 * "One OPEN shift per user" is a PARTIAL unique index. Prisma 5.x has no declarative form for
 * it on PostgreSQL, so it is invisible to schema.prisma and `prisma migrate dev` will offer to
 * DROP it as drift. Accepting that would remove the only thing collapsing a concurrent-open
 * race — openShift depends on the resulting P2002.
 *
 * This test reads the migration history the way PostgreSQL does and fails if the index stops
 * being created, or if any migration drops it without recreating it. It is the cheapest place
 * to catch the mistake: in review, before it reaches a contour.
 */

const INDEX = 'WorkShift_one_open_per_user_key'
const MIGRATIONS_DIR = join(__dirname, '..', '..', 'prisma', 'migrations')

function migrationsInOrder(): Array<{ name: string; sql: string }> {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8') }))
}

describe('one OPEN shift per user', () => {
  it('is created by the migration history', () => {
    const creators = migrationsInOrder().filter((m) => new RegExp(`CREATE UNIQUE INDEX[^;]*"${INDEX}"`, 's').test(m.sql))

    expect(creators.length).toBeGreaterThan(0)
  })

  it('is a PARTIAL index on userId WHERE status = OPEN, not a plain unique', () => {
    // A plain @@unique([userId]) would forbid a user from ever having a second shift — the
    // opposite of the rule — so the WHERE clause is the whole point.
    const creator = migrationsInOrder().find((m) => m.sql.includes(`CREATE UNIQUE INDEX "${INDEX}"`))
    expect(creator).toBeDefined()

    const statement = creator!.sql
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.includes(`"${INDEX}"`))!

    expect(statement).toMatch(/ON "WorkShift"\("userId"\)/)
    expect(statement).toMatch(/WHERE "status" = 'OPEN'/)
  })

  it('survives the whole history: nothing drops it without recreating it afterwards', () => {
    let present = false
    for (const migration of migrationsInOrder()) {
      for (const raw of migration.sql.split(';')) {
        const statement = raw.trim()
        if (!statement.includes(`"${INDEX}"`)) continue
        if (/^DROP\s+INDEX/i.test(statement)) present = false
        if (/^CREATE\s+UNIQUE\s+INDEX/i.test(statement)) present = true
      }
    }

    expect(present).toBe(true)
  })

  it('is re-asserted idempotently by 106B, so a database that lost it heals on deploy', () => {
    const m = migrationsInOrder().find((x) => x.name.endsWith('_shift_labor_ledger_integrity'))
    expect(m).toBeDefined()
    expect(m!.sql).toMatch(new RegExp(`CREATE UNIQUE INDEX IF NOT EXISTS\\s+"${INDEX}"`))
  })
})
