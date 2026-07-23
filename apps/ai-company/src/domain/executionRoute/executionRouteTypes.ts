/**
 * Execution routes — neutral domain contract (envelope decoupling, commit 1/7).
 *
 * `ExecutionRouteId` is the platform-wide set of execution routes. The Cursor
 * Path C routes (AI-COMPANY-109) are a *subset* of it, not the definition of it:
 * a local analysis run produces no branch, commit or pull request, yet it is
 * still an execution route and still yields a result envelope.
 *
 * Identifiers only — no policy, no cost guard, no transport. Cursor route
 * selection stays in `domain/cursorExecutionRoute/` and keeps operating over
 * the Cursor subset alone, so its two route switches (both of which carry a
 * `default` branch and would therefore swallow a new value silently) never see
 * a non-Cursor route.
 */

/** Cursor Path C routes (AI-COMPANY-109). Mirrors `EXECUTION_ROUTES`. */
export const CURSOR_EXECUTION_ROUTE_IDS = [
  'LOCAL_CURSOR_BRIDGE',
  'MANUAL_CLOUD_AGENT',
  'CURSOR_AUTOMATION_WEBHOOK',
] as const

export type CursorExecutionRouteId = (typeof CURSOR_EXECUTION_ROUTE_IDS)[number]

/** Every execution route the platform knows — Cursor and non-Cursor alike. */
export const EXECUTION_ROUTE_IDS = [
  'LOCAL_CURSOR_BRIDGE',
  'MANUAL_CLOUD_AGENT',
  'CURSOR_AUTOMATION_WEBHOOK',
  'LOCAL_OLLAMA_ANALYSIS',
] as const

export type ExecutionRouteId = (typeof EXECUTION_ROUTE_IDS)[number]

/**
 * Compile-time subset proof: every Cursor route must also be an `ExecutionRouteId`.
 *
 * Do not delete or widen this. Without it a divergence between the two tuples —
 * a typo, or a value added to one list only — stops being a compile error and
 * becomes a runtime `parseCursorResultEnvelope → null`, which is precisely the
 * silent-failure class this split exists to prevent.
 */
const _subsetCheck: readonly ExecutionRouteId[] = CURSOR_EXECUTION_ROUTE_IDS
void _subsetCheck

export function isExecutionRouteId(value: string): value is ExecutionRouteId {
  return (EXECUTION_ROUTE_IDS as readonly string[]).includes(value)
}

export function isCursorExecutionRoute(value: string): value is CursorExecutionRouteId {
  return (CURSOR_EXECUTION_ROUTE_IDS as readonly string[]).includes(value)
}
