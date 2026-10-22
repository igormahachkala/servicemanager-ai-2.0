/**
 * Two "browsers" (separate storages) + a real state-bridge server in-process.
 */
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { startStateBridgeServer, type StateBridgeServer } from '../../tools/state-bridge/src/server.ts'
import { createStateStore } from '../../tools/state-bridge/src/stateStore.ts'
import { createServerStateSync, isSharedKey, patchStorageForSync } from './serverStateSync.ts'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()
  get length() {
    return this.data.size
  }
  clear() {
    this.data.clear()
  }
  getItem(k: string) {
    return this.data.has(k) ? (this.data.get(k) as string) : null
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null
  }
  removeItem(k: string) {
    this.data.delete(k)
  }
  setItem(k: string, v: string) {
    this.data.set(k, String(v))
  }
}

// Each browser gets its own subclass so prototype patches don't collide.
function browserStorage(): Storage {
  class S extends MemoryStorage {}
  return new S()
}

let server: StateBridgeServer
let dir = ''
let base = ''

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-bridge-'))
  server = await startStateBridgeServer({ host: '127.0.0.1', port: 0, dataDir: dir })
  base = `http://127.0.0.1:${server.port}`
})
after(async () => {
  await server.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

function makeBrowser(storage: Storage, changed: string[] = []) {
  const sync = createServerStateSync({
    baseUrl: base,
    storage,
    pushDelayMs: 1,
    onRemoteChange: (key) => changed.push(key),
  })
  patchStorageForSync(storage, sync)
  return sync
}

describe('isSharedKey', () => {
  it('shares app data, keeps device preferences local', () => {
    assert.equal(isSharedKey('ai-company-tool-execution-runs'), true)
    assert.equal(isSharedKey('ai-company-language'), false)
    assert.equal(isSharedKey('other-app'), false)
  })
})

describe('two browsers, one company', () => {
  const a = browserStorage()
  const b = browserStorage()
  const bChanged: string[] = []
  let syncA: ReturnType<typeof makeBrowser>
  let syncB: ReturnType<typeof makeBrowser>
  before(() => {
    // Data already in each browser before the app (and the patch) starts.
    a.setItem('ai-company-projects', '[1]')
    a.setItem('ai-company-language', 'ru')
    b.setItem('ai-company-stale', 'x')
    b.setItem('ai-company-language', 'en')
    syncA = makeBrowser(a)
    syncB = makeBrowser(b, bChanged)
  })

  it('first device uploads its existing data', async () => {
    assert.equal(await syncA.boot(), 'uploaded')
    const snap = server.store.snapshot()
    assert.equal(snap.keys['ai-company-projects'], '[1]')
    assert.equal(snap.keys['ai-company-language'], undefined)
  })

  it('second device boots with the server copy, local-only keys dropped', async () => {
    assert.equal(await syncB.boot(), 'synced')
    assert.equal(b.getItem('ai-company-projects'), '[1]')
    assert.equal(b.getItem('ai-company-stale'), null)
    assert.equal(b.getItem('ai-company-language'), 'en') // device preference survives
  })

  it('a write on A reaches B with a storage notification', async () => {
    a.setItem('ai-company-projects', '[1,2]')
    await syncA.flush()
    const applied = await syncB.pullOnce()
    assert.equal(applied, 1)
    assert.equal(b.getItem('ai-company-projects'), '[1,2]')
    assert.ok(bChanged.includes('ai-company-projects'))
  })

  it('a delete on B reaches A', async () => {
    b.removeItem('ai-company-projects')
    await syncB.flush()
    await syncA.pullOnce()
    assert.equal(a.getItem('ai-company-projects'), null)
  })

  it('remote apply does not echo back as a new write', async () => {
    const before = server.store.rev
    await syncB.pullOnce()
    await syncB.flush()
    assert.equal(server.store.rev, before)
  })

  it('a pending local write wins over an incoming remote value', async () => {
    a.setItem('ai-company-reports', '"from-a"')
    await syncA.flush()
    b.setItem('ai-company-reports', '"from-b-unsent"') // queued, not flushed yet
    await syncB.pullOnce()
    assert.equal(b.getItem('ai-company-reports'), '"from-b-unsent"')
    await syncB.flush()
    await syncA.pullOnce()
    assert.equal(a.getItem('ai-company-reports'), '"from-b-unsent"') // last write wins
  })
})

describe('offline server', () => {
  it('boot falls back to local only', async () => {
    const s = browserStorage()
    s.setItem('ai-company-projects', '[9]')
    const sync = createServerStateSync({ baseUrl: 'http://127.0.0.1:1', storage: s, bootTimeoutMs: 500 })
    assert.equal(await sync.boot(), 'offline')
    assert.equal(s.getItem('ai-company-projects'), '[9]')
  })
})

describe('state file', () => {
  it('survives a restart and asks stale clients to resync', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'state-file-'))
    const s1 = createStateStore({ dir: d })
    s1.apply([{ key: 'ai-company-x', value: '1' }, { key: 'not-shared', value: '2' }])
    s1.flush()
    const s2 = createStateStore({ dir: d })
    assert.deepEqual(s2.snapshot().keys, { 'ai-company-x': '1' })
    assert.equal(s2.changesSince(0).reset, true)
    assert.equal(s2.changesSince(s2.rev).reset, false)
    assert.ok(fs.readdirSync(d).some((n) => /^state-\d{4}-\d{2}-\d{2}\.json$/.test(n)))
    fs.rmSync(d, { recursive: true, force: true })
  })
})
