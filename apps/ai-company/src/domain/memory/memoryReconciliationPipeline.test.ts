import assert from 'node:assert/strict'
import test from 'node:test'
import type { MemoryEntry } from './memoryEntry'
import { reconcileMemory } from './memoryReconciliation'
import { applyReconciliation, SUPERSEDED_TAG, STALE_TAG } from './memoryReconciliationApply'
import {
  HeuristicContradictionJudge,
  ScriptedContradictionJudge,
  partitionConflictsByVerdict,
} from './contradictionJudge'

function mem(o: Record<string, unknown>): MemoryEntry {
  return {
    id: 'x', employeeId: 'emp-1', type: 'insight', title: '', summary: '', content: '',
    importance: 'medium', retention: 'long', tags: [], workspaceId: null, source: 'run',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...o,
  } as unknown as MemoryEntry
}

const morning = mem({ id: 'a', source: 'run', createdAt: '2026-01-01T00:00:00.000Z',
  title: 'Заказчик Альфа', content: 'Заказчик Альфа предпочитает доставку по утрам' })
const evening = mem({ id: 'b', source: 'manual', createdAt: '2026-02-01T00:00:00.000Z',
  title: 'Заказчик Альфа', content: 'Заказчик Альфа предпочитает доставку по вечерам' })

test('(a) applyReconciliation tags superseded existing, keeps history', () => {
  const decision = reconcileMemory(evening, [morning])
  const { incoming, updatedExisting } = applyReconciliation(evening, [morning], decision, '2026-02-01T00:00:00.000Z')
  const a = updatedExisting.find((e) => e.id === 'a')!
  assert.ok(a.tags.includes(SUPERSEDED_TAG))
  assert.ok(a.tags.includes('superseded-by:b'))
  assert.equal(updatedExisting.length, 1) // nothing deleted
  assert.ok(!incoming.tags.includes(STALE_TAG)) // incoming is current
})

test('(a) a stale incoming is tagged, not the existing', () => {
  const decision = reconcileMemory(morning, [evening]) // morning(run) loses to evening(manual)
  const { incoming } = applyReconciliation(morning, [evening], decision, '2026-02-02T00:00:00.000Z')
  assert.ok(incoming.tags.includes(STALE_TAG))
  assert.ok(incoming.tags.includes('superseded-by:b'))
})

test('(b) heuristic judge: duplicate only for near-identical, never contradicts', async () => {
  const j = new HeuristicContradictionJudge()
  assert.deepEqual(await j.judge('доставка по утрам альфа', 'доставка по утрам альфа'), { contradicts: false, duplicate: true })
  const v = await j.judge('доставка по утрам', 'контактное лицо иван')
  assert.equal(v.duplicate, false)
})

test('(b) partition conflicts by an (LLM-shaped) judge verdict', async () => {
  const decision = reconcileMemory(evening, [morning])
  const judge = new ScriptedContradictionJudge((a, b) => ({
    contradicts: a.includes('вечер') && b.includes('утр'),
    duplicate: false,
  }))
  const verdicts: Record<string, { contradicts: boolean; duplicate: boolean }> = {}
  for (const c of decision.conflicts) verdicts[c.existingId] = await judge.judge(evening.content, morning.content)
  const parts = partitionConflictsByVerdict(decision.conflicts, verdicts)
  assert.deepEqual(parts.contradictingIds, ['a'])
  assert.deepEqual(parts.duplicateIds, [])
})
