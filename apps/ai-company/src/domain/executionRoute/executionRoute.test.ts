/**
 * Execution routes — neutral layer tests (envelope decoupling, commit 1/7).
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  CURSOR_EXECUTION_ROUTE_IDS,
  EXECUTION_ROUTE_IDS,
  isCursorExecutionRoute,
  isExecutionRouteId,
} from './executionRouteTypes.ts'
import { EXECUTION_ROUTES } from '../cursorExecutionRoute/cursorExecutionRouteTypes.ts'

/** Non-Cursor routes must be listed here consciously, not appear by accident. */
const EXPECTED_NON_CURSOR_ROUTES = ['LOCAL_OLLAMA_ANALYSIS']

describe('execution route identifiers', () => {
  it('contains every Cursor route in the superset', () => {
    for (const route of CURSOR_EXECUTION_ROUTE_IDS) {
      assert.ok(
        (EXECUTION_ROUTE_IDS as readonly string[]).includes(route),
        `${route} is missing from EXECUTION_ROUTE_IDS`,
      )
    }
  })

  /**
   * Tautological by design since 0c36131: EXECUTION_ROUTES *is*
   * CURSOR_EXECUTION_ROUTE_IDS, so this compares an array with itself and
   * cannot currently fail. It is kept as a guard against re-introducing the
   * literals in cursorExecutionRouteTypes.ts — the day someone inlines the
   * three strings there again, this starts comparing two independent tuples
   * and earns its keep. Do not read it as a working check today.
   */
  it('still mirrors the Cursor route tuple used by the route policy', () => {
    assert.deepEqual([...CURSOR_EXECUTION_ROUTE_IDS], [...EXECUTION_ROUTES])
  })

  it('adds the local analysis route and nothing unaccounted for', () => {
    const nonCursor = (EXECUTION_ROUTE_IDS as readonly string[]).filter(
      (route) => !(CURSOR_EXECUTION_ROUTE_IDS as readonly string[]).includes(route),
    )
    assert.deepEqual(nonCursor, EXPECTED_NON_CURSOR_ROUTES)
  })

  it('has no duplicate identifiers in either tuple', () => {
    assert.equal(new Set(EXECUTION_ROUTE_IDS).size, EXECUTION_ROUTE_IDS.length)
    assert.equal(new Set(CURSOR_EXECUTION_ROUTE_IDS).size, CURSOR_EXECUTION_ROUTE_IDS.length)
  })
})

describe('isExecutionRouteId', () => {
  it('accepts every known route', () => {
    for (const route of EXECUTION_ROUTE_IDS) {
      assert.equal(isExecutionRouteId(route), true, route)
    }
  })

  it('rejects unknown, empty and wrongly-cased values', () => {
    assert.equal(isExecutionRouteId('NOPE'), false)
    assert.equal(isExecutionRouteId(''), false)
    assert.equal(isExecutionRouteId('local_ollama_analysis'), false)
    assert.equal(isExecutionRouteId(' LOCAL_OLLAMA_ANALYSIS '), false)
  })
})

describe('isCursorExecutionRoute', () => {
  it('accepts the three Cursor routes', () => {
    for (const route of CURSOR_EXECUTION_ROUTE_IDS) {
      assert.equal(isCursorExecutionRoute(route), true, route)
    }
  })

  it('rejects the local analysis route', () => {
    assert.equal(isCursorExecutionRoute('LOCAL_OLLAMA_ANALYSIS'), false)
  })

  it('rejects unknown values', () => {
    assert.equal(isCursorExecutionRoute('NOPE'), false)
    assert.equal(isCursorExecutionRoute(''), false)
  })

  it('never accepts what isExecutionRouteId rejects', () => {
    for (const route of [...EXECUTION_ROUTE_IDS, 'NOPE', '']) {
      if (isCursorExecutionRoute(route)) {
        assert.equal(isExecutionRouteId(route), true, `${route} passed the narrow guard only`)
      }
    }
  })
})
