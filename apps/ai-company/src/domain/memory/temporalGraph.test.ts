import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createGraph, upsertEntity, addEdge, edgesAt, currentEdges, neighborsAt,
  type GraphEdge,
} from './temporalGraph'

function edge(o: Partial<GraphEdge> & { id: string; from: string; to: string; type: string; validFrom: string }): GraphEdge {
  return { validTo: null, recordedAt: o.validFrom, ...o }
}

let g = createGraph()
g = upsertEntity(g, { id: 'cust', type: 'customer', label: 'Альфа' })
g = upsertEntity(g, { id: 'morning', type: 'window', label: 'утро' })
g = upsertEntity(g, { id: 'evening', type: 'window', label: 'вечер' })
g = upsertEntity(g, { id: 'ivan', type: 'person', label: 'Иван' })

test('single-valued update invalidates the prior edge non-destructively', () => {
  let graph = addEdge(g, edge({ id: 'e1', from: 'cust', to: 'morning', type: 'prefers', validFrom: '2026-01-01T00:00:00Z' }), { singleValued: true })
  graph = addEdge(graph, edge({ id: 'e2', from: 'cust', to: 'evening', type: 'prefers', validFrom: '2026-02-01T00:00:00Z' }), { singleValued: true })
  // history preserved: both edges exist, e1 now closed
  assert.equal(graph.edges.length, 2)
  const e1 = graph.edges.find((e) => e.id === 'e1')!
  assert.equal(e1.validTo, '2026-02-01T00:00:00Z')
  // current = only evening
  const cur = currentEdges(graph)
  assert.deepEqual(cur.map((e) => e.to), ['evening'])
})

test('time-travel: "as of" an earlier date shows the old relationship', () => {
  let graph = addEdge(g, edge({ id: 'e1', from: 'cust', to: 'morning', type: 'prefers', validFrom: '2026-01-01T00:00:00Z' }), { singleValued: true })
  graph = addEdge(graph, edge({ id: 'e2', from: 'cust', to: 'evening', type: 'prefers', validFrom: '2026-02-01T00:00:00Z' }), { singleValued: true })
  assert.deepEqual(edgesAt(graph, '2026-01-15T00:00:00Z').map((e) => e.to), ['morning'])
  assert.deepEqual(edgesAt(graph, '2026-03-01T00:00:00Z').map((e) => e.to), ['evening'])
})

test('non-single-valued relationships coexist', () => {
  let graph = addEdge(g, edge({ id: 'c1', from: 'cust', to: 'ivan', type: 'contact_of', validFrom: '2026-01-01T00:00:00Z' }))
  graph = addEdge(graph, edge({ id: 'c2', from: 'cust', to: 'morning', type: 'prefers', validFrom: '2026-01-01T00:00:00Z' }))
  const n = neighborsAt(graph, 'cust', '2026-06-01T00:00:00Z')
  assert.equal(n.length, 2)
  const contacts = neighborsAt(graph, 'cust', '2026-06-01T00:00:00Z', 'contact_of')
  assert.deepEqual(contacts.map((e) => e.id), ['ivan'])
})
