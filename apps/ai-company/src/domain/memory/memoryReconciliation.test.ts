import assert from 'node:assert/strict'
import test from 'node:test'
import { reconcileMemory, memorySimilarity } from './memoryReconciliation'
import type { MemoryEntry } from './memoryEntry'

function mem(o: Record<string, unknown>): MemoryEntry {
  return {
    id: 'x',
    employeeId: 'emp-1',
    type: 'insight',
    title: '',
    summary: '',
    content: '',
    importance: 'medium',
    retention: 'long',
    tags: [],
    workspaceId: null,
    source: 'run',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...o,
  } as unknown as MemoryEntry
}

const morning = mem({ id: 'a', source: 'run', createdAt: '2026-01-01T00:00:00.000Z',
  title: 'Заказчик Альфа', content: 'Заказчик Альфа предпочитает доставку по утрам' })
const evening = mem({ id: 'b', source: 'manual', createdAt: '2026-02-01T00:00:00.000Z',
  title: 'Заказчик Альфа', content: 'Заказчик Альфа предпочитает доставку по вечерам' })

test('similarity is high for same-subject entries, low for unrelated', () => {
  assert.ok(memorySimilarity(morning, evening) > 0.4)
  const other = mem({ id: 'c', content: 'Синхронизация каталога завершена' })
  assert.ok(memorySimilarity(morning, other) < 0.2)
})

test('newer + more authoritative incoming supersedes existing (user > agent)', () => {
  const r = reconcileMemory(evening, [morning])
  assert.equal(r.conflicts.length, 1)
  assert.deepEqual(r.supersededExistingIds, ['a'])
  assert.equal(r.incomingIsCurrent, true)
})

test('a stronger existing supersedes a weaker incoming (incoming is stale)', () => {
  const r = reconcileMemory(morning, [evening]) // morning=run(2), evening=manual(5)
  assert.equal(r.incomingIsCurrent, false)
  assert.equal(r.supersededByExistingId, 'b')
  assert.deepEqual(r.supersededExistingIds, [])
})

test('same authority: newer wins by recency', () => {
  const older = mem({ id: 'o', source: 'run', createdAt: '2026-01-01T00:00:00.000Z',
    title: 'Правило сборки', content: 'Сборка проекта через npm run build в каталоге apps' })
  const newer = mem({ id: 'n', source: 'run', createdAt: '2026-03-01T00:00:00.000Z',
    title: 'Правило сборки', content: 'Сборка проекта через npm run build в каталоге apps ai' })
  const r = reconcileMemory(newer, [older])
  assert.deepEqual(r.supersededExistingIds, ['o'])
})

test('different type or low overlap => no conflict', () => {
  const otherType = mem({ id: 'd', type: 'task',
    title: 'Заказчик Альфа', content: 'Заказчик Альфа предпочитает доставку по утрам' })
  assert.equal(reconcileMemory(evening, [otherType]).conflicts.length, 0)
  const unrelated = mem({ id: 'e', content: 'Совсем другая тема без пересечений' })
  assert.equal(reconcileMemory(evening, [unrelated]).conflicts.length, 0)
})
