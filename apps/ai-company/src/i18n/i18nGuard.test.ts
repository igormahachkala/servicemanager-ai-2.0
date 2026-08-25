import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'
import { hasCyrillic } from './i18nGuard'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')
const baseline: string[] = JSON.parse(readFileSync(join(SRC, 'i18n', 'i18nCyrillicBaseline.json'), 'utf8'))

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === 'i18n') continue // translation bundles legitimately hold Cyrillic
      walk(p, acc)
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      acc.push(p)
    }
  }
  return acc
}

function offenders(): string[] {
  return walk(SRC)
    .filter((p) => hasCyrillic(readFileSync(p, 'utf8')))
    .map((p) => relative(SRC, p).split('\\').join('/'))
}

test('no NEW hardcoded-Cyrillic files outside src/i18n (ratchet)', () => {
  const allow = new Set(baseline)
  const fresh = offenders().filter((o) => !allow.has(o))
  assert.deepEqual(fresh, [], `Move Cyrillic UI text to src/i18n. New offenders: ${fresh.join(', ')}`)
})

test('baseline stays honest — cleaned files must be removed from it', () => {
  const current = new Set(offenders())
  const stale = baseline.filter((b) => !current.has(b))
  assert.deepEqual(stale, [], `These baseline files are already clean — delete them from the baseline: ${stale.join(', ')}`)
})
