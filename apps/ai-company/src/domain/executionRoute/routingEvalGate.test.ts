import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateRoutingGate } from './routingEvalGate'

const baseline = { passRate: 0.95, editRate: 0.05, groundedness: 0.9, sampleSize: 100 }

test('allows a candidate on par with baseline and enough samples', () => {
  const d = evaluateRoutingGate(baseline, { passRate: 0.93, editRate: 0.08, groundedness: 0.88, sampleSize: 50 })
  assert.equal(d.allowed, true)
  assert.deepEqual(d.reasons, [])
})

test('blocks a passRate regression beyond policy', () => {
  const d = evaluateRoutingGate(baseline, { passRate: 0.8, sampleSize: 50 }) // 0.15 regression > 0.05
  assert.equal(d.allowed, false)
  assert.match(d.reasons.join('|'), /passRate regression/)
})

test('blocks an insufficient eval sample', () => {
  const d = evaluateRoutingGate(baseline, { passRate: 0.95, sampleSize: 5 })
  assert.equal(d.allowed, false)
  assert.match(d.reasons.join('|'), /insufficient eval sample/)
})

test('blocks an excessive edit rate', () => {
  const d = evaluateRoutingGate(baseline, { passRate: 0.94, editRate: 0.35, sampleSize: 50 })
  assert.equal(d.allowed, false)
  assert.match(d.reasons.join('|'), /editRate/)
})

test('blocks below a groundedness floor when policy sets one', () => {
  const d = evaluateRoutingGate(baseline, { passRate: 0.94, groundedness: 0.6, sampleSize: 50 }, { minGroundedness: 0.8 })
  assert.equal(d.allowed, false)
  assert.match(d.reasons.join('|'), /groundedness/)
})

test('collects multiple block reasons at once', () => {
  const d = evaluateRoutingGate(baseline, { passRate: 0.5, editRate: 0.4, sampleSize: 3 })
  assert.equal(d.allowed, false)
  assert.ok(d.reasons.length >= 3)
})
