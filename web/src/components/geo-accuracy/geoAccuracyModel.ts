export const GEO_ACCURACY_RANGE_KEYS = [
  'LT_10',
  'FROM_10_20',
  'FROM_20_30',
  'FROM_30_40',
  'FROM_40_50',
  'FROM_50_60',
  'FROM_60_100',
  'GT_100',
] as const

export const GEO_ACCURACY_MISSING_KEY = 'MISSING' as const

export const GEO_ACCURACY_BUCKET_KEYS = [...GEO_ACCURACY_RANGE_KEYS, GEO_ACCURACY_MISSING_KEY] as const

export type GeoAccuracyRangeKey = (typeof GEO_ACCURACY_RANGE_KEYS)[number]
export type GeoAccuracyBucketKey = (typeof GEO_ACCURACY_BUCKET_KEYS)[number]

export type GeoAccuracyBucketView = {
  key: GeoAccuracyBucketKey
  label: string
  count: number
}

export type GeoAccuracyCellBounds = {
  south: number
  west: number
  north: number
  east: number
}

export type GeoAccuracyCounts = Record<GeoAccuracyBucketKey, number>

export type GeoAccuracyCellView = {
  bounds: GeoAccuracyCellBounds
  counts: GeoAccuracyCounts
}

export type GeoAccuracySettingsView = {
  accuracyMeters: number
  freshnessMinutes: number
  radiusMeters: number
}

export const GEO_ACCURACY_LABEL: Record<GeoAccuracyBucketKey, string> = {
  LT_10: '<10м',
  FROM_10_20: '10-20м',
  FROM_20_30: '20-30м',
  FROM_30_40: '30-40м',
  FROM_40_50: '40-50м',
  FROM_50_60: '50-60м',
  FROM_60_100: '60-100м',
  GT_100: '>100м',
  MISSING: 'без точности',
}

export const GEO_ACCURACY_RANGE_COLOR: Record<GeoAccuracyRangeKey, string> = {
  LT_10: '#0f766e',
  FROM_10_20: '#0d9488',
  FROM_20_30: '#65a30d',
  FROM_30_40: '#ca8a04',
  FROM_40_50: '#d97706',
  FROM_50_60: '#ea580c',
  FROM_60_100: '#dc2626',
  GT_100: '#9f1239',
}

export const GEO_ACCURACY_MISSING_COLOR = '#64748b'

const BUCKET_KEY_SET = new Set<string>(GEO_ACCURACY_BUCKET_KEYS)

export function bucketColor(key: GeoAccuracyBucketKey): string {
  if (key === GEO_ACCURACY_MISSING_KEY) return GEO_ACCURACY_MISSING_COLOR
  return GEO_ACCURACY_RANGE_COLOR[key]
}

export function isGeoAccuracyBucketKey(value: string): value is GeoAccuracyBucketKey {
  return BUCKET_KEY_SET.has(value)
}

export function emptyCounts(): GeoAccuracyCounts {
  return {
    LT_10: 0,
    FROM_10_20: 0,
    FROM_20_30: 0,
    FROM_30_40: 0,
    FROM_40_50: 0,
    FROM_50_60: 0,
    FROM_60_100: 0,
    GT_100: 0,
    MISSING: 0,
  }
}

export function cellKey(bounds: GeoAccuracyCellBounds): string {
  return `${bounds.south}:${bounds.west}:${bounds.north}:${bounds.east}`
}

export function isRangeSwitchedOff(
  key: GeoAccuracyBucketKey,
  enabled: ReadonlySet<GeoAccuracyRangeKey>,
): boolean {
  if (key === GEO_ACCURACY_MISSING_KEY) return false
  return !enabled.has(key)
}

export function dominantRangeKey(
  counts: GeoAccuracyCounts,
  enabled: ReadonlySet<GeoAccuracyRangeKey>,
): GeoAccuracyRangeKey | null {
  let winner: GeoAccuracyRangeKey | null = null
  let winnerCount = 0
  let tie = false

  for (const key of GEO_ACCURACY_RANGE_KEYS) {
    if (!enabled.has(key)) continue
    const count = counts[key]
    if (count > winnerCount) {
      winner = key
      winnerCount = count
      tie = false
    } else if (count === winnerCount && count > 0) {
      tie = true
    }
  }

  if (!winner || tie) return null
  return winner
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return 'Не удалось выполнить запрос'
}

export type ReadPositive =
  | { ok: true; omit: true }
  | { ok: true; omit: false; value: number }
  | { ok: false; message: string }

export function readPositive(raw: string): ReadPositive {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: true, omit: true }
  const normalized = trimmed.replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return { ok: false, message: 'Нужно число больше нуля' }
  }
  const value = Number(normalized)
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, message: 'Нужно число больше нуля' }
  }
  return { ok: true, omit: false, value }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function readFinite(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function readCount(value: unknown): number | null {
  const count = readFinite(value)
  if (count === null || count < 0) return null
  return count
}

function applyBucketList(counts: GeoAccuracyCounts, raw: unknown) {
  if (!Array.isArray(raw)) return
  for (const item of raw) {
    if (!isRecord(item) || typeof item.key !== 'string' || !isGeoAccuracyBucketKey(item.key)) continue
    const count = readCount(item.count)
    if (count === null) continue
    counts[item.key] = count
  }
}

export function normalizeBuckets(raw: unknown): GeoAccuracyBucketView[] {
  const counts = emptyCounts()
  applyBucketList(counts, isRecord(raw) ? raw.buckets : undefined)
  return GEO_ACCURACY_BUCKET_KEYS.map((key) => ({
    key,
    label: GEO_ACCURACY_LABEL[key],
    count: counts[key],
  }))
}

function readBounds(row: Record<string, unknown>): GeoAccuracyCellBounds | null {
  const south = readFinite(row.south)
  const north = readFinite(row.north)
  const west = readFinite(row.west)
  const east = readFinite(row.east)
  if (south === null || west === null || north === null || east === null) return null
  if (!(south < north) || !(west < east)) return null
  return { south, west, north, east }
}

function readCell(row: unknown): GeoAccuracyCellView | null {
  if (!isRecord(row)) return null
  const bounds = readBounds(row)
  if (!bounds) return null
  const counts = emptyCounts()
  applyBucketList(counts, row.buckets)
  return { bounds, counts }
}

export function normalizeCells(raw: unknown): GeoAccuracyCellView[] {
  if (!isRecord(raw) || !Array.isArray(raw.cells)) return []
  return raw.cells.flatMap((item) => {
    const cell = readCell(item)
    return cell ? [cell] : []
  })
}

export function normalizeSettings(raw: unknown): GeoAccuracySettingsView | null {
  if (!isRecord(raw)) return null
  const accuracyMeters = readCount(raw.accuracyMeters)
  const freshnessMinutes = readCount(raw.freshnessMinutes)
  const radiusMeters = readCount(raw.radiusMeters)
  if (accuracyMeters === null || freshnessMinutes === null || radiusMeters === null) return null
  if (accuracyMeters <= 0 || freshnessMinutes <= 0 || radiusMeters <= 0) return null
  return { accuracyMeters, freshnessMinutes, radiusMeters }
}
