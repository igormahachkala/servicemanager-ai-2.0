/**
 * State Bridge — the company's shared state on the server (one JSON file).
 *
 * The SPA keeps every store in localStorage under `ai-company-*`. This store is
 * the server copy of those keys, so every browser (office, home, phone) sees
 * the same company. Model: key -> raw string value, plus a global revision
 * counter; each write bumps it, so a client asks "what changed since rev N".
 * Conflict policy V1: last write wins per key.
 */

import fs from 'node:fs'
import path from 'node:path'

export type StateEntry = { value: string; rev: number; updatedAt: string }
export type StateFile = { version: 1; rev: number; keys: Record<string, StateEntry> }
export type StateChange = { key: string; value: string | null; rev: number }

export const STATE_KEY_PREFIX = 'ai-company-'
export const MAX_VALUE_BYTES = 8 * 1024 * 1024

export function isSyncableKey(key: unknown): key is string {
  return typeof key === 'string' && key.startsWith(STATE_KEY_PREFIX) && key.length <= 200
}

export type StateStore = {
  snapshot(): { rev: number; keys: Record<string, string> }
  changesSince(since: number): { rev: number; changes: StateChange[]; reset: boolean }
  apply(changes: Array<{ key: string; value: string | null }>): { rev: number; applied: number }
  flush(): void
  readonly rev: number
}

/** Deleted keys are kept as tombstones so other clients learn about the delete. */
type Tombstone = { rev: number; updatedAt: string }

export function createStateStore(options: { dir: string; writeDelayMs?: number }): StateStore {
  const file = path.join(options.dir, 'state.json')
  fs.mkdirSync(options.dir, { recursive: true })

  let state: StateFile = { version: 1, rev: 0, keys: {} }
  const tombstones = new Map<string, Tombstone>()
  // Changes older than what we remember can't be replayed — the client resyncs.
  const loadedAtRev = (() => {
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as StateFile
      if (parsed && parsed.version === 1 && typeof parsed.rev === 'number' && parsed.keys) state = parsed
    }
    return state.rev
  })()

  let timer: NodeJS.Timeout | null = null
  const writeDelayMs = options.writeDelayMs ?? 250

  function writeNow(): void {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(state))
    fs.renameSync(tmp, file) // atomic replace: a crash never leaves half a file
    backupDaily()
  }

  function scheduleWrite(): void {
    if (timer) return
    timer = setTimeout(writeNow, writeDelayMs)
  }

  function backupDaily(): void {
    const day = new Date().toISOString().slice(0, 10)
    const backup = path.join(options.dir, `state-${day}.json`)
    if (!fs.existsSync(backup)) fs.copyFileSync(file, backup)
    // keep the last 14 daily copies
    const copies = fs
      .readdirSync(options.dir)
      .filter((n) => /^state-\d{4}-\d{2}-\d{2}\.json$/.test(n))
      .sort()
    for (const old of copies.slice(0, Math.max(0, copies.length - 14))) {
      fs.rmSync(path.join(options.dir, old), { force: true })
    }
  }

  return {
    get rev() {
      return state.rev
    },

    snapshot() {
      const keys: Record<string, string> = {}
      for (const [k, entry] of Object.entries(state.keys)) keys[k] = entry.value
      return { rev: state.rev, keys }
    },

    changesSince(since) {
      // Ahead of the server (state file replaced) or older than this process's
      // memory of deletes (tombstones are not persisted): take a full snapshot.
      if (since > state.rev || since < loadedAtRev) {
        return { rev: state.rev, changes: [], reset: true }
      }
      const changes: StateChange[] = []
      for (const [key, entry] of Object.entries(state.keys)) {
        if (entry.rev > since) changes.push({ key, value: entry.value, rev: entry.rev })
      }
      for (const [key, t] of tombstones) {
        if (t.rev > since && !(key in state.keys)) changes.push({ key, value: null, rev: t.rev })
      }
      changes.sort((a, b) => a.rev - b.rev)
      return { rev: state.rev, changes, reset: false }
    },

    apply(changes) {
      let applied = 0
      const now = new Date().toISOString()
      for (const change of changes) {
        if (!isSyncableKey(change.key)) continue
        if (change.value === null) {
          if (!(change.key in state.keys)) continue
          state.rev += 1
          delete state.keys[change.key]
          tombstones.set(change.key, { rev: state.rev, updatedAt: now })
          applied += 1
          continue
        }
        if (typeof change.value !== 'string') continue
        if (Buffer.byteLength(change.value) > MAX_VALUE_BYTES) continue
        if (state.keys[change.key]?.value === change.value) continue // no-op write
        state.rev += 1
        state.keys[change.key] = { value: change.value, rev: state.rev, updatedAt: now }
        tombstones.delete(change.key)
        applied += 1
      }
      if (applied > 0) scheduleWrite()
      return { rev: state.rev, applied }
    },

    flush() {
      if (timer) writeNow()
    },
  }
}
