/**
 * Mobile Reports — circular dependency regression (AI-COMPANY-115B).
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const testDir = path.dirname(fileURLToPath(import.meta.url))

describe('mobile report module graph', () => {
  it('mobileReportConstants stays free of navigation and snapshot imports', () => {
    const source = readFileSync(path.join(testDir, 'mobileReportConstants.ts'), 'utf8')
    assert.doesNotMatch(source, /mobileHrefResolver/)
    assert.doesNotMatch(source, /mobileReportsSnapshot/)
  })

  it('href resolver and snapshot load without temporal dead zone', async () => {
    const constants = await import('./mobileReportConstants.ts')
    const hrefResolver = await import('../navigation/mobileHrefResolver.ts')
    const snapshot = await import('./mobileReportsSnapshot.ts')

    assert.equal(constants.MOBILE_MORNING_REPORT_ID, 'morning-report')
    assert.equal(
      hrefResolver.MOBILE_PATHS.morningReport,
      `/mobile/reports/${constants.MOBILE_MORNING_REPORT_ID}`,
    )
    assert.equal(typeof snapshot.buildMobileReportsSnapshot, 'function')
    assert.equal(typeof snapshot.resolveMobileReportDetail, 'function')
  })
})
