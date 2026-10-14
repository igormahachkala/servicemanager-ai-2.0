/**
 * Дописывает координаты площадкам, у которых есть адрес, но нет координат.
 *
 * Без флага --apply только считает выборки и показывает, что было бы записано.
 * С флагом --apply пишет широту и долготу. Другие поля площадки не меняются,
 * площадки с обеими координатами не трогаются.
 *
 * Точка пишется только при точности 2GIS exact или number и единственном найденном
 * здании. Остальные площадки выводятся списком для ручной правки, как и площадки
 * без адреса и без координат: по ним 2GIS не вызывается.
 *
 * Использование в контейнере backend:
 *   npx ts-node scripts/backfill-location-coords.ts
 *   npx ts-node scripts/backfill-location-coords.ts --apply
 *
 * Нужны DATABASE_URL и TWOGIS_API_KEY. Ключ в вывод не попадает.
 */

import { PrismaClient } from '@prisma/client'

import {
  decideBackfill,
  lacksAddressAndCoords,
  needsGeocode,
  type BackfillLocationRow,
} from '../src/locations/location-coords-backfill'
import { TwogisGeocoderService } from '../src/twogis/twogis-geocoder.service'
import { readTwogisApiKey } from '../src/twogis/twogis.types'

/** Geocoder limit is 600 requests per minute. */
const REQUEST_INTERVAL_MS = 150

const prisma = new PrismaClient()

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function describeRow(row: BackfillLocationRow) {
  return `${row.id} | company ${row.clientCompanyId} | ${row.name} | ${row.city ?? '—'} | ${row.address ?? '—'}`
}

async function loadRows(): Promise<BackfillLocationRow[]> {
  return prisma.location.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      clientCompanyId: true,
      name: true,
      city: true,
      address: true,
      latitude: true,
      longitude: true,
    },
    orderBy: [{ clientCompanyId: 'asc' }, { name: 'asc' }],
  })
}

async function main() {
  const apply = process.argv.includes('--apply')
  if (!readTwogisApiKey()) {
    throw new Error('TWOGIS_API_KEY is not set')
  }

  const rows = await loadRows()
  const toGeocode = rows.filter(needsGeocode)
  const withoutAddress = rows.filter(lacksAddressAndCoords)

  console.log(`mode: ${apply ? 'apply' : 'dry-run'}`)
  console.log(`locations: ${rows.length}`)
  console.log(`with address, without coordinates: ${toGeocode.length}`)
  console.log(`without address and coordinates: ${withoutAddress.length}`)

  const geocoder = new TwogisGeocoderService(fetch)
  const written: string[] = []
  const rejected: string[] = []
  const skippedRace: string[] = []

  for (const [index, row] of toGeocode.entries()) {
    if (index > 0) await sleep(REQUEST_INTERVAL_MS)
    const hit = await geocoder.geocodeAddress({ city: row.city, address: row.address })
    const decision = decideBackfill(hit)

    if (decision.kind === 'reject') {
      const found = hit ? ` | 2GIS: ${hit.fullName || '—'}` : ''
      rejected.push(
        `${describeRow(row)} | ${decision.reason} | precision ${decision.precision ?? '—'} | matches ${decision.matchCount}${found}`,
      )
      continue
    }

    const line = `${describeRow(row)} | ${decision.precision} | ${decision.latitude}, ${decision.longitude}`
    if (!apply) {
      written.push(line)
      continue
    }

    const result = await prisma.location.updateMany({
      where: { id: row.id, deletedAt: null, OR: [{ latitude: null }, { longitude: null }] },
      data: { latitude: decision.latitude, longitude: decision.longitude },
    })
    if (result.count === 1) written.push(line)
    else skippedRace.push(describeRow(row))
  }

  console.log('')
  console.log(`${apply ? 'written' : 'would write'}: ${written.length}`)
  written.forEach((line) => console.log(`  ${line}`))
  console.log(`rejected: ${rejected.length}`)
  rejected.forEach((line) => console.log(`  ${line}`))
  if (skippedRace.length > 0) {
    console.log(`changed by someone during the run, not written: ${skippedRace.length}`)
    skippedRace.forEach((line) => console.log(`  ${line}`))
  }
  console.log(`without address and coordinates: ${withoutAddress.length}`)
  withoutAddress.forEach((row) => console.log(`  ${describeRow(row)}`))

  if (apply) {
    const remaining = (await loadRows()).filter(needsGeocode).length
    console.log('')
    console.log(`with address, without coordinates after run: ${remaining}`)
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
