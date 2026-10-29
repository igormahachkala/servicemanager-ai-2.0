import { GeoAccuracyBucketKey } from '@prisma/client'

import { GEO_ACCURACY_CELL_METERS, PLATFORM_ARRIVAL_SETTINGS_ID } from './geo-accuracy.constants'
import { geoAccuracyCell } from './geo-accuracy.buckets'
import { GeoAccuracyService, recordGeoAccuracyPoint } from './geo-accuracy.service'

const RECORDED_AT = new Date('2026-10-27T07:01:00.000Z')

describe('recordGeoAccuracyPoint', () => {
  it('writes the sample with accuracy and without it, and counts only the matching bucket', async () => {
    const upserts: Array<{ where: { key: string } }> = []
    const samples: Array<Record<string, unknown>> = []
    const tx = {
      geoAccuracyBucket: {
        upsert: jest.fn(async (args: { where: { key: string } }) => {
          upserts.push(args)
          return args
        }),
      },
      geoAccuracySample: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          samples.push(data)
          return data
        }),
      },
    }

    await recordGeoAccuracyPoint(tx as never, {
      companyId: 'provider-1',
      latitude: 55.75,
      longitude: 37.62,
      accuracy: 40,
      recordedAt: RECORDED_AT,
    })
    await recordGeoAccuracyPoint(tx as never, {
      companyId: 'provider-1',
      latitude: 55.75,
      longitude: 37.62,
      accuracy: 100,
      recordedAt: RECORDED_AT,
    })
    await recordGeoAccuracyPoint(tx as never, {
      companyId: 'provider-1',
      latitude: 55.75,
      longitude: 37.62,
      accuracy: null,
      recordedAt: RECORDED_AT,
    })
    await recordGeoAccuracyPoint(tx as never, {
      companyId: 'provider-1',
      latitude: 55.76,
      longitude: 37.63,
      accuracy: Number.NaN,
      recordedAt: RECORDED_AT,
    })

    expect(upserts.map((call) => call.where.key)).toEqual([
      GeoAccuracyBucketKey.FROM_40_50,
      GeoAccuracyBucketKey.GT_100,
      GeoAccuracyBucketKey.MISSING,
      GeoAccuracyBucketKey.MISSING,
    ])
    expect(samples.map((sample) => sample.accuracy)).toEqual([40, 100, null, null])
    expect(samples.every((sample) => sample.recordedAt === RECORDED_AT)).toBe(true)
    expect(samples.every((sample) => sample.companyId === 'provider-1')).toBe(true)
    for (const sample of samples) {
      expect(sample).not.toHaveProperty('userId')
      expect(sample).not.toHaveProperty('technicianId')
    }
  })
})

describe('GeoAccuracyService', () => {
  function makePrisma(initial: {
    accuracyMeters: number
    freshnessMinutes: number
    radiusMeters: number
  } | null) {
    let row = initial
      ? { id: PLATFORM_ARRIVAL_SETTINGS_ID, ...initial }
      : null
    const prisma = {
      platformArrivalSettings: {
        findUnique: jest.fn(async () => row),
        upsert: jest.fn(async ({ create, update }: { create: typeof row; update: Record<string, number> }) => {
          row = row ? { ...row, ...update } : (create as NonNullable<typeof row>)
          return row
        }),
      },
      geoAccuracyBucket: {
        findMany: jest.fn().mockResolvedValue([{ key: GeoAccuracyBucketKey.LT_10, count: 2 }]),
      },
      geoAccuracySample: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      readRow: () => row,
    }
    return prisma
  }

  it('keeps a zero count for a bucket that has no row, including MISSING', async () => {
    const prisma = makePrisma(null)
    const service = new GeoAccuracyService(prisma as never)
    const result = await service.listBuckets()

    expect(result.buckets).toHaveLength(9)
    expect(result.buckets.map((bucket) => bucket.key)).toEqual([
      GeoAccuracyBucketKey.LT_10,
      GeoAccuracyBucketKey.FROM_10_20,
      GeoAccuracyBucketKey.FROM_20_30,
      GeoAccuracyBucketKey.FROM_30_40,
      GeoAccuracyBucketKey.FROM_40_50,
      GeoAccuracyBucketKey.FROM_50_60,
      GeoAccuracyBucketKey.FROM_60_100,
      GeoAccuracyBucketKey.GT_100,
      GeoAccuracyBucketKey.MISSING,
    ])
    expect(result.buckets.find((bucket) => bucket.key === GeoAccuracyBucketKey.LT_10)?.count).toBe(2)
    expect(result.buckets.find((bucket) => bucket.key === GeoAccuracyBucketKey.MISSING)?.count).toBe(0)
    expect(result.buckets.find((bucket) => bucket.key === GeoAccuracyBucketKey.GT_100)?.count).toBe(0)
  })

  it('returns no cells without companyId and does not read samples', async () => {
    const prisma = makePrisma(null)
    const service = new GeoAccuracyService(prisma as never)

    await expect(service.listCells(undefined)).resolves.toEqual({
      companyId: null,
      cellMeters: GEO_ACCURACY_CELL_METERS,
      cells: [],
    })
    await expect(service.listCells('   ')).resolves.toEqual({
      companyId: null,
      cellMeters: GEO_ACCURACY_CELL_METERS,
      cells: [],
    })
    expect(prisma.geoAccuracySample.findMany).not.toHaveBeenCalled()
  })

  it('groups one provider company into 100 m cells with every bucket count', async () => {
    const prisma = makePrisma(null)
    prisma.geoAccuracySample.findMany.mockResolvedValue([
      { latitude: 55.75, longitude: 37.62, accuracy: 10 },
      { latitude: 55.75, longitude: 37.62, accuracy: 100 },
      { latitude: 55.75, longitude: 37.62, accuracy: null },
      { latitude: 10, longitude: 10, accuracy: 40 },
    ])
    const service = new GeoAccuracyService(prisma as never)
    const result = await service.listCells('provider-1')
    const near = geoAccuracyCell(55.75, 37.62)
    const far = geoAccuracyCell(10, 10)

    expect(prisma.geoAccuracySample.findMany).toHaveBeenCalledWith({
      where: { companyId: 'provider-1' },
      select: { latitude: true, longitude: true, accuracy: true },
    })
    expect(result.companyId).toBe('provider-1')
    expect(result.cellMeters).toBe(100)
    expect(result.cells).toHaveLength(2)
    expect(JSON.stringify(result)).not.toContain('userId')

    const nearCell = result.cells.find((cell) => cell.south === near.south && cell.west === near.west)
    const farCell = result.cells.find((cell) => cell.south === far.south && cell.west === far.west)
    expect(nearCell).toMatchObject({ south: near.south, north: near.north, west: near.west, east: near.east })
    expect(farCell).toMatchObject({ south: far.south, north: far.north, west: far.west, east: far.east })
    expect(nearCell?.buckets).toHaveLength(9)
    expect(nearCell?.buckets.find((bucket) => bucket.key === GeoAccuracyBucketKey.FROM_10_20)?.count).toBe(1)
    expect(nearCell?.buckets.find((bucket) => bucket.key === GeoAccuracyBucketKey.GT_100)?.count).toBe(1)
    expect(nearCell?.buckets.find((bucket) => bucket.key === GeoAccuracyBucketKey.MISSING)?.count).toBe(1)
    expect(nearCell?.buckets.find((bucket) => bucket.key === GeoAccuracyBucketKey.LT_10)?.count).toBe(0)
    expect(farCell?.buckets.find((bucket) => bucket.key === GeoAccuracyBucketKey.FROM_40_50)?.count).toBe(1)
    expect(nearCell).not.toHaveProperty('points')
  })

  it('returns 100, 10 and 100 when the settings row is absent and an empty patch does not create it', async () => {
    const prisma = makePrisma(null)
    const service = new GeoAccuracyService(prisma as never)

    await expect(service.getSettings()).resolves.toEqual({
      accuracyMeters: 100,
      freshnessMinutes: 10,
      radiusMeters: 100,
    })
    await expect(service.patchSettings({})).resolves.toEqual({
      accuracyMeters: 100,
      freshnessMinutes: 10,
      radiusMeters: 100,
    })
    expect(prisma.platformArrivalSettings.upsert).not.toHaveBeenCalled()
    expect(prisma.readRow()).toBeNull()
  })

  it('does not change the stored settings when the patch is zero or negative', async () => {
    const prisma = makePrisma({ accuracyMeters: 80, freshnessMinutes: 15, radiusMeters: 40 })
    const service = new GeoAccuracyService(prisma as never)

    await expect(
      service.patchSettings({ accuracyMeters: 0, freshnessMinutes: -1, radiusMeters: 0 }),
    ).resolves.toEqual({
      accuracyMeters: 80,
      freshnessMinutes: 15,
      radiusMeters: 40,
    })
    expect(prisma.platformArrivalSettings.upsert).not.toHaveBeenCalled()
    expect(prisma.readRow()).toMatchObject({
      accuracyMeters: 80,
      freshnessMinutes: 15,
      radiusMeters: 40,
    })
  })

  it('writes a positive radius and leaves the other two at 100 and 10', async () => {
    const prisma = makePrisma(null)
    const service = new GeoAccuracyService(prisma as never)

    await expect(service.patchSettings({ radiusMeters: 250 })).resolves.toEqual({
      accuracyMeters: 100,
      freshnessMinutes: 10,
      radiusMeters: 250,
    })
    expect(prisma.platformArrivalSettings.upsert).toHaveBeenCalledWith({
      where: { id: PLATFORM_ARRIVAL_SETTINGS_ID },
      create: {
        id: PLATFORM_ARRIVAL_SETTINGS_ID,
        accuracyMeters: 100,
        freshnessMinutes: 10,
        radiusMeters: 250,
      },
      update: {
        accuracyMeters: 100,
        freshnessMinutes: 10,
        radiusMeters: 250,
      },
    })
  })
})
