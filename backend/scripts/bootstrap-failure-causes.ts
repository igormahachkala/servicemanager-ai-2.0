/*
 * Backfill стандартного справочника Failure Causes для существующих CLIENT-компаний.
 *
 * ПО УМОЛЧАНИЮ — только отчёт (dry-run), НИКАКИХ мутаций:
 *   dotenv -e .env -- ts-node scripts/bootstrap-failure-causes.ts
 *
 * Применить (создаёт 12 стандартных причин ТОЛЬКО в CLIENT-компаниях с 0 причин):
 *   dotenv -e .env -- ts-node scripts/bootstrap-failure-causes.ts --apply
 *
 * Семантика apply идентична bootstrap при создании компании
 * (ensureDefaultFailureCauses, seed-only-if-empty): partial / custom / full
 * компании НЕ трогаются, так что отредактированные/деактивированные/удалённые
 * причины не восстанавливаются. Скрипт подключается к БД только при запуске.
 */
import { CompanyType, PrismaClient } from '@prisma/client'

import {
  STANDARD_FAILURE_CAUSE_NAMES,
  ensureDefaultFailureCauses,
} from '../src/failure-causes/standard-failure-causes'

const STANDARD = new Set<string>(STANDARD_FAILURE_CAUSE_NAMES)

type Bucket = 'empty' | 'partial-standard' | 'full-standard' | 'has-custom'

async function main() {
  const apply = process.argv.includes('--apply')
  const prisma = new PrismaClient()
  try {
    const clients = await prisma.company.findMany({
      where: { type: CompanyType.CLIENT },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    })

    const counts: Record<Bucket, number> = {
      empty: 0,
      'partial-standard': 0,
      'full-standard': 0,
      'has-custom': 0,
    }
    const emptyIds: string[] = []

    for (const c of clients) {
      const causes = await prisma.failureCause.findMany({
        where: { companyId: c.id },
        select: { name: true },
      })
      if (causes.length === 0) {
        counts.empty++
        emptyIds.push(c.id)
        continue
      }
      const hasCustom = causes.some((x) => !STANDARD.has(x.name))
      const standardPresent = causes.filter((x) => STANDARD.has(x.name)).length
      let bucket: Bucket
      if (hasCustom) bucket = 'has-custom'
      else if (standardPresent >= STANDARD.size) bucket = 'full-standard'
      else bucket = 'partial-standard'
      counts[bucket]++
    }

    console.log('[failure-causes-backfill] mode:', apply ? 'APPLY' : 'REPORT (dry-run)')
    console.log('[failure-causes-backfill] CLIENT companies total:', clients.length)
    console.log('[failure-causes-backfill]   empty (0 causes)      :', counts.empty)
    console.log('[failure-causes-backfill]   partial standard dict :', counts['partial-standard'])
    console.log('[failure-causes-backfill]   full standard dict    :', counts['full-standard'])
    console.log('[failure-causes-backfill]   has custom causes     :', counts['has-custom'])

    if (!apply) {
      console.log(
        `[failure-causes-backfill] DRY-RUN: would seed ${counts.empty} empty CLIENT companies with ` +
          `${STANDARD_FAILURE_CAUSE_NAMES.length} standard causes each. Re-run with --apply to execute.`,
      )
      return
    }

    let seeded = 0
    for (const id of emptyIds) {
      const res = await ensureDefaultFailureCauses(prisma, id)
      if (res.created > 0) seeded++
      console.log(`[failure-causes-backfill] company ${id}: created=${res.created} skipped=${res.skipped ?? '-'}`)
    }
    console.log(`[failure-causes-backfill] APPLY done: ${seeded}/${emptyIds.length} empty companies seeded.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('[failure-causes-backfill] failed:', err)
  process.exit(1)
})
