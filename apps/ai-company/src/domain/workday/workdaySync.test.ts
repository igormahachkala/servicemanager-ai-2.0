/**
 * Reading the workday dashboard must not write when nothing changed: every
 * write fires CHANGE_EVENT and useWorkday re-reads on it, so an unconditional
 * write recursed until "Maximum call stack size exceeded" (/ops/day -> /ops/canvas).
 */
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

let changeEvents = 0
let writes = 0

before(() => {
  const data = new Map<string, string>()
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (k === 'ai-company-workdays') writes += 1
      data.set(k, v)
    },
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size
    },
  }
  ;(globalThis as Record<string, unknown>).localStorage = storage
  ;(globalThis as Record<string, unknown>).window = {
    localStorage: storage,
    location: { origin: 'http://localhost:5174', hostname: 'localhost', host: 'localhost:5174', protocol: 'http:' },
    dispatchEvent: (e: Event) => {
      if (e.type.includes('workday')) changeEvents += 1
      return true
    },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }
})

describe('syncWorkdaysFromPlatform', () => {
  it('writes on the first sync and not again when nothing changed', async () => {
    const { syncWorkdaysFromPlatform } = await import('./workdayEngine.ts')
    const first = syncWorkdaysFromPlatform()
    assert.ok(first.length > 0)
    const writesAfterFirst = writes
    assert.ok(writesAfterFirst > 0)
    const eventsAfterFirst = changeEvents
    syncWorkdaysFromPlatform()
    syncWorkdaysFromPlatform()
    assert.equal(writes, writesAfterFirst, 'no writes on unchanged re-sync')
    assert.equal(changeEvents, eventsAfterFirst, 'no change events on unchanged re-sync')
  })
})
