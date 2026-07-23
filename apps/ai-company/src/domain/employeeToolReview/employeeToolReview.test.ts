/**
 * Employee Tool Review — check gate outcome and stored-record upgrade.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { evaluateCursorResultForBuilderReview } from './employeeToolReviewEvaluation.ts'
import {
  checksPassedFromOutcome,
  isEmployeeToolReviewChecksOutcome,
} from './employeeToolReviewTypes.ts'
import { upgradeStoredEvaluation } from './employeeToolReviewStorage.ts'
import type { CursorResultEnvelope } from '../cursorResult/cursorResultEnvelopeTypes.ts'
import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes.ts'

function envelope(overrides: Partial<CursorResultEnvelope> = {}): CursorResultEnvelope {
  return {
    version: 'v1',
    runId: 'terun-1',
    status: 'completed',
    summary: 'Done',
    changedFiles: [],
    checks: [],
    errors: [],
    warnings: [],
    assumptions: [],
    unfinishedItems: [],
    completedAt: '2026-07-23T10:00:00.000Z',
    ...overrides,
  } as CursorResultEnvelope
}

function run(overrides: Partial<ToolExecutionRun> = {}): ToolExecutionRun {
  return {
    id: 'terun-1',
    fileScope: [],
    checks: [],
    expectedResult: '',
    ...overrides,
  } as ToolExecutionRun
}

const PASSING_CHECK = { name: 'build', status: 'passed', outputSummary: '' }
const FAILING_CHECK = { name: 'build', status: 'failed', outputSummary: 'tsc error' }

describe('checksOutcome', () => {
  it('1. passed — checks were reported and all succeeded', () => {
    const evaluation = evaluateCursorResultForBuilderReview(
      envelope({ checks: [PASSING_CHECK] as CursorResultEnvelope['checks'] }),
      run({ checks: ['npm run build'] }),
    )
    assert.equal(evaluation.checksOutcome, 'passed')
    assert.equal(evaluation.checksPassed, true)
  })

  it('2. failed — a reported check did not pass', () => {
    const evaluation = evaluateCursorResultForBuilderReview(
      envelope({ checks: [FAILING_CHECK] as CursorResultEnvelope['checks'] }),
      run({ checks: ['npm run build'] }),
    )
    assert.equal(evaluation.checksOutcome, 'failed')
    assert.equal(evaluation.checksPassed, false)
  })

  it('3. not_required — nothing reported and nothing was requested', () => {
    const evaluation = evaluateCursorResultForBuilderReview(envelope(), run({ checks: [] }))
    assert.equal(evaluation.checksOutcome, 'not_required')
    assert.equal(evaluation.checksPassed, true)
  })

  it('4. missing — checks were requested but none came back', () => {
    const evaluation = evaluateCursorResultForBuilderReview(
      envelope(),
      run({ checks: ['npm run build', 'npm run test:domain'] }),
    )
    assert.equal(evaluation.checksOutcome, 'missing')
    assert.equal(evaluation.checksPassed, false)
  })

  it('5. missing raises a note naming the checks; not_required raises none', () => {
    const missing = evaluateCursorResultForBuilderReview(
      envelope(),
      run({ checks: ['npm run build'] }),
    )
    assert.ok(missing.notes.some((note) => note.includes('required but none were reported')))
    assert.ok(missing.notes.some((note) => note.includes('npm run build')))

    const notRequired = evaluateCursorResultForBuilderReview(envelope(), run({ checks: [] }))
    assert.deepEqual(notRequired.notes, [])
  })

  it('6. failed keeps the original note and does not claim checks are missing', () => {
    const evaluation = evaluateCursorResultForBuilderReview(
      envelope({ checks: [FAILING_CHECK] as CursorResultEnvelope['checks'] }),
      run({ checks: ['npm run build'] }),
    )
    assert.ok(evaluation.notes.some((note) => note === 'One or more checks did not pass.'))
    assert.ok(!evaluation.notes.some((note) => note.includes('none were reported')))
  })

  it('7. an empty check list no longer reads two ways at once', () => {
    // Before: expected-result alignment treated [] as "all passed" while the
    // gate treated it as a failure. Both now follow checksOutcome.
    const analysis = evaluateCursorResultForBuilderReview(
      envelope({ summary: 'Audit complete' }),
      run({ checks: [], expectedResult: 'nothing matching here' }),
    )
    assert.equal(analysis.checksOutcome, 'not_required')
    assert.equal(analysis.expectedResultAligned, true)

    const skipped = evaluateCursorResultForBuilderReview(
      envelope({ summary: 'Audit complete' }),
      run({ checks: ['npm run build'], expectedResult: 'nothing matching here' }),
    )
    assert.equal(skipped.checksOutcome, 'missing')
    assert.equal(skipped.expectedResultAligned, false)
  })
})

describe('checksPassedFromOutcome', () => {
  it('8. only failed and missing are not passing', () => {
    assert.equal(checksPassedFromOutcome('passed'), true)
    assert.equal(checksPassedFromOutcome('not_required'), true)
    assert.equal(checksPassedFromOutcome('failed'), false)
    assert.equal(checksPassedFromOutcome('missing'), false)
  })

  it('9. the outcome guard rejects anything else', () => {
    assert.equal(isEmployeeToolReviewChecksOutcome('passed'), true)
    assert.equal(isEmployeeToolReviewChecksOutcome('PASSED'), false)
    assert.equal(isEmployeeToolReviewChecksOutcome(undefined), false)
    assert.equal(isEmployeeToolReviewChecksOutcome(true), false)
  })
})

describe('stored record upgrade', () => {
  const legacy = {
    fileScopeOk: true,
    outOfScopeFiles: [],
    checkAssessments: [],
    expectedResultAligned: true,
    hasErrors: false,
    hasUnfinished: false,
    notes: [],
  }

  it('10. a legacy record with checksPassed true becomes passed', () => {
    const upgraded = upgradeStoredEvaluation({ ...legacy, checksPassed: true })
    assert.equal(upgraded.checksOutcome, 'passed')
    assert.equal(upgraded.checksPassed, true)
    assert.equal(upgraded.fileScopeOk, true)
  })

  it('11. a legacy record with checksPassed false becomes failed, not missing', () => {
    const upgraded = upgradeStoredEvaluation({ ...legacy, checksPassed: false })
    assert.equal(upgraded.checksOutcome, 'failed')
    assert.equal(upgraded.checksPassed, false)
  })

  it('12. an already-upgraded record keeps its outcome', () => {
    const upgraded = upgradeStoredEvaluation({
      ...legacy,
      checksOutcome: 'not_required',
      checksPassed: false,
    })
    assert.equal(upgraded.checksOutcome, 'not_required')
    // checksPassed is derived, so a stale stored value is corrected on read.
    assert.equal(upgraded.checksPassed, true)
  })

  it('13. a corrupt outcome falls back to the boolean', () => {
    const upgraded = upgradeStoredEvaluation({
      ...legacy,
      checksOutcome: 'nonsense',
      checksPassed: true,
    })
    assert.equal(upgraded.checksOutcome, 'passed')
  })
})
