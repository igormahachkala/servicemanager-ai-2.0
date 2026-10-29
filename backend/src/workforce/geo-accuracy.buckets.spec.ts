import { GeoAccuracyBucketKey } from '@prisma/client'

import { geoAccuracyBucketKey, geoAccuracyCell } from './geo-accuracy.buckets'

describe('geo accuracy bucket bounds', () => {
  const cases: Array<[unknown, GeoAccuracyBucketKey]> = [
    [0, GeoAccuracyBucketKey.LT_10],
    [9.999, GeoAccuracyBucketKey.LT_10],
    [10, GeoAccuracyBucketKey.FROM_10_20],
    [19.999, GeoAccuracyBucketKey.FROM_10_20],
    [20, GeoAccuracyBucketKey.FROM_20_30],
    [30, GeoAccuracyBucketKey.FROM_30_40],
    [39.999, GeoAccuracyBucketKey.FROM_30_40],
    [40, GeoAccuracyBucketKey.FROM_40_50],
    [49.999, GeoAccuracyBucketKey.FROM_40_50],
    [50, GeoAccuracyBucketKey.FROM_50_60],
    [60, GeoAccuracyBucketKey.FROM_60_100],
    [99.999, GeoAccuracyBucketKey.FROM_60_100],
    [100, GeoAccuracyBucketKey.GT_100],
    [100.1, GeoAccuracyBucketKey.GT_100],
    [1000, GeoAccuracyBucketKey.GT_100],
    [undefined, GeoAccuracyBucketKey.MISSING],
    [null, GeoAccuracyBucketKey.MISSING],
    [Number.NaN, GeoAccuracyBucketKey.MISSING],
    [Number.POSITIVE_INFINITY, GeoAccuracyBucketKey.MISSING],
    [-0.01, GeoAccuracyBucketKey.MISSING],
    [-1, GeoAccuracyBucketKey.MISSING],
    ['10', GeoAccuracyBucketKey.MISSING],
    ['', GeoAccuracyBucketKey.MISSING],
  ]

  it.each(cases)('puts %s into %s', (accuracy, key) => {
    expect(geoAccuracyBucketKey(accuracy)).toBe(key)
  })

  it('does not treat an empty accuracy as a ranged bucket', () => {
    expect(geoAccuracyBucketKey(undefined)).toBe(GeoAccuracyBucketKey.MISSING)
    expect(geoAccuracyBucketKey(null)).not.toBe(GeoAccuracyBucketKey.LT_10)
    expect(geoAccuracyBucketKey(-1)).not.toBe(GeoAccuracyBucketKey.GT_100)
  })
})

describe('geo accuracy cells', () => {
  it('keeps the centre of a cell inside that cell', () => {
    const cell = geoAccuracyCell(55.751244, 37.618423)
    const centre = geoAccuracyCell((cell.south + cell.north) / 2, (cell.west + cell.east) / 2)
    expect(centre.latIndex).toBe(cell.latIndex)
    expect(centre.lonIndex).toBe(cell.lonIndex)
    expect(cell.north).toBeGreaterThan(cell.south)
    expect(cell.east).toBeGreaterThan(cell.west)
  })
})
