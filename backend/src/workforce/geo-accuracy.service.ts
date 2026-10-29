import { Injectable } from '@nestjs/common'
import { GeoAccuracyBucketKey, Prisma } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { GEO_ACCURACY_CELL_METERS, PLATFORM_ARRIVAL_SETTINGS_ID } from './geo-accuracy.constants'
import {
  emptyBucketCounts,
  geoAccuracyBucketKey,
  geoAccuracyCell,
  GEO_ACCURACY_BUCKET_KEYS,
} from './geo-accuracy.buckets'
import { ON_SITE_ACCURACY_M, ON_SITE_FRESH_MS, ON_SITE_RADIUS_M } from './workforce-on-site.rules'

export type GeoAccuracyBucketCount = {
  key: GeoAccuracyBucketKey
  count: number
}

export type GeoAccuracyCellDto = {
  south: number
  north: number
  west: number
  east: number
  buckets: GeoAccuracyBucketCount[]
}

export type PlatformArrivalSettingsView = {
  accuracyMeters: number
  freshnessMinutes: number
  radiusMeters: number
}

export type GeoAccuracyPointInput = {
  companyId: string
  latitude: number
  longitude: number
  accuracy: unknown
  recordedAt: Date
}

const DEFAULT_SETTINGS: PlatformArrivalSettingsView = {
  accuracyMeters: ON_SITE_ACCURACY_M,
  freshnessMinutes: ON_SITE_FRESH_MS / 60_000,
  radiusMeters: ON_SITE_RADIUS_M,
}

function bucketList(counts: Record<GeoAccuracyBucketKey, number>): GeoAccuracyBucketCount[] {
  return GEO_ACCURACY_BUCKET_KEYS.map((key) => ({ key, count: counts[key] }))
}

/** Ноль, отрицательное и нецелое не записываются. */
export function positiveSetting(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) return undefined
  return value
}

export async function recordGeoAccuracyPoint(
  tx: Prisma.TransactionClient,
  input: GeoAccuracyPointInput,
): Promise<void> {
  const key = geoAccuracyBucketKey(input.accuracy)
  const accuracy = key === GeoAccuracyBucketKey.MISSING ? null : (input.accuracy as number)
  await tx.geoAccuracyBucket.upsert({
    where: { key },
    create: { key, count: 1 },
    update: { count: { increment: 1 } },
  })
  await tx.geoAccuracySample.create({
    data: {
      companyId: input.companyId,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy,
      recordedAt: input.recordedAt,
    },
  })
}

@Injectable()
export class GeoAccuracyService {
  constructor(private readonly prisma: PrismaService) {}

  async listBuckets(): Promise<{ buckets: GeoAccuracyBucketCount[] }> {
    const rows = await this.prisma.geoAccuracyBucket.findMany()
    const counts = emptyBucketCounts()
    for (const row of rows) counts[row.key] = row.count
    return { buckets: bucketList(counts) }
  }

  async listCells(companyId?: string): Promise<{
    companyId: string | null
    cellMeters: number
    cells: GeoAccuracyCellDto[]
  }> {
    const id = typeof companyId === 'string' ? companyId.trim() : ''
    if (!id) {
      return { companyId: null, cellMeters: GEO_ACCURACY_CELL_METERS, cells: [] }
    }

    const samples = await this.prisma.geoAccuracySample.findMany({
      where: { companyId: id },
      select: { latitude: true, longitude: true, accuracy: true },
    })

    const groups = new Map<
      string,
      { south: number; north: number; west: number; east: number; counts: Record<GeoAccuracyBucketKey, number> }
    >()

    for (const sample of samples) {
      if (!Number.isFinite(sample.latitude) || !Number.isFinite(sample.longitude)) continue
      const cell = geoAccuracyCell(sample.latitude, sample.longitude)
      const groupKey = `${cell.latIndex}:${cell.lonIndex}`
      let group = groups.get(groupKey)
      if (!group) {
        group = {
          south: cell.south,
          north: cell.north,
          west: cell.west,
          east: cell.east,
          counts: emptyBucketCounts(),
        }
        groups.set(groupKey, group)
      }
      group.counts[geoAccuracyBucketKey(sample.accuracy)] += 1
    }

    const cells = [...groups.values()]
      .sort((left, right) => left.south - right.south || left.west - right.west)
      .map((group) => ({
        south: group.south,
        north: group.north,
        west: group.west,
        east: group.east,
        buckets: bucketList(group.counts),
      }))

    return { companyId: id, cellMeters: GEO_ACCURACY_CELL_METERS, cells }
  }

  async getSettings(): Promise<PlatformArrivalSettingsView> {
    return this.readSettingsRow()
  }

  async patchSettings(input: {
    accuracyMeters?: unknown
    freshnessMinutes?: unknown
    radiusMeters?: unknown
  }): Promise<PlatformArrivalSettingsView> {
    const accuracyMeters = positiveSetting(input.accuracyMeters)
    const freshnessMinutes = positiveSetting(input.freshnessMinutes)
    const radiusMeters = positiveSetting(input.radiusMeters)
    const current = await this.readSettingsRow()
    if (accuracyMeters === undefined && freshnessMinutes === undefined && radiusMeters === undefined) {
      return current
    }

    const next: PlatformArrivalSettingsView = {
      accuracyMeters: accuracyMeters ?? current.accuracyMeters,
      freshnessMinutes: freshnessMinutes ?? current.freshnessMinutes,
      radiusMeters: radiusMeters ?? current.radiusMeters,
    }
    const saved = await this.prisma.platformArrivalSettings.upsert({
      where: { id: PLATFORM_ARRIVAL_SETTINGS_ID },
      create: { id: PLATFORM_ARRIVAL_SETTINGS_ID, ...next },
      update: next,
    })
    return {
      accuracyMeters: saved.accuracyMeters,
      freshnessMinutes: saved.freshnessMinutes,
      radiusMeters: saved.radiusMeters,
    }
  }

  private async readSettingsRow(): Promise<PlatformArrivalSettingsView> {
    const row = await this.prisma.platformArrivalSettings.findUnique({
      where: { id: PLATFORM_ARRIVAL_SETTINGS_ID },
      select: { accuracyMeters: true, freshnessMinutes: true, radiusMeters: true },
    })
    if (!row) return { ...DEFAULT_SETTINGS }
    return {
      accuracyMeters: row.accuracyMeters,
      freshnessMinutes: row.freshnessMinutes,
      radiusMeters: row.radiusMeters,
    }
  }
}
