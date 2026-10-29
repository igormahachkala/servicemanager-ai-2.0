import { GeoAccuracyBucketKey } from '@prisma/client'

import { GEO_ACCURACY_CELL_METERS } from './geo-accuracy.constants'

/** Средняя длина градуса широты, метры. Клетка считается от этого шага. */
const METERS_PER_DEGREE_LATITUDE = 111_320

export const GEO_ACCURACY_BUCKET_KEYS: GeoAccuracyBucketKey[] = [
  GeoAccuracyBucketKey.LT_10,
  GeoAccuracyBucketKey.FROM_10_20,
  GeoAccuracyBucketKey.FROM_20_30,
  GeoAccuracyBucketKey.FROM_30_40,
  GeoAccuracyBucketKey.FROM_40_50,
  GeoAccuracyBucketKey.FROM_50_60,
  GeoAccuracyBucketKey.FROM_60_100,
  GeoAccuracyBucketKey.GT_100,
  GeoAccuracyBucketKey.MISSING,
]

/**
 * Нижняя граница включена, верхняя исключена.
 * Ровно 10 м попадает в FROM_10_20, ровно 100 м в GT_100.
 * Пустая accuracy, не число и число меньше 0 идут в MISSING.
 */
export function geoAccuracyBucketKey(accuracy: unknown): GeoAccuracyBucketKey {
  if (typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy < 0) {
    return GeoAccuracyBucketKey.MISSING
  }
  if (accuracy < 10) return GeoAccuracyBucketKey.LT_10
  if (accuracy < 20) return GeoAccuracyBucketKey.FROM_10_20
  if (accuracy < 30) return GeoAccuracyBucketKey.FROM_20_30
  if (accuracy < 40) return GeoAccuracyBucketKey.FROM_30_40
  if (accuracy < 50) return GeoAccuracyBucketKey.FROM_40_50
  if (accuracy < 60) return GeoAccuracyBucketKey.FROM_50_60
  if (accuracy < 100) return GeoAccuracyBucketKey.FROM_60_100
  return GeoAccuracyBucketKey.GT_100
}

export type GeoAccuracyCellBounds = {
  latIndex: number
  lonIndex: number
  south: number
  north: number
  west: number
  east: number
}

/** Клетка 100 м. Нижняя и западная границы включены, верхняя и восточная исключены. */
export function geoAccuracyCell(latitude: number, longitude: number): GeoAccuracyCellBounds {
  const latIndex = Math.floor((latitude * METERS_PER_DEGREE_LATITUDE) / GEO_ACCURACY_CELL_METERS)
  const south = (latIndex * GEO_ACCURACY_CELL_METERS) / METERS_PER_DEGREE_LATITUDE
  const north = ((latIndex + 1) * GEO_ACCURACY_CELL_METERS) / METERS_PER_DEGREE_LATITUDE
  const midLatRad = (((south + north) / 2) * Math.PI) / 180
  const metersPerDegreeLon = METERS_PER_DEGREE_LATITUDE * Math.max(Math.abs(Math.cos(midLatRad)), 1e-6)
  const lonIndex = Math.floor((longitude * metersPerDegreeLon) / GEO_ACCURACY_CELL_METERS)
  const west = (lonIndex * GEO_ACCURACY_CELL_METERS) / metersPerDegreeLon
  const east = ((lonIndex + 1) * GEO_ACCURACY_CELL_METERS) / metersPerDegreeLon
  return { latIndex, lonIndex, south, north, west, east }
}

export function emptyBucketCounts(): Record<GeoAccuracyBucketKey, number> {
  return GEO_ACCURACY_BUCKET_KEYS.reduce(
    (counts, key) => {
      counts[key] = 0
      return counts
    },
    {} as Record<GeoAccuracyBucketKey, number>,
  )
}
