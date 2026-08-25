/**
 * Routing Eval Gate — the CI-eval-gate for model routing.
 *
 * Before routing a class of tasks to a cheaper/local candidate model, require its
 * eval metrics to stay within policy of the frontier baseline. Cheap models degrade
 * SILENTLY (slightly worse answers, no errors), so a downgrade must be gated on
 * evidence, not vibes. Pure and dependency-free.
 */

export type RoutingEvalMetrics = {
  /** fraction of eval cases passing verification, 0..1 */
  passRate: number
  /** optional groundedness score, 0..1 */
  groundedness?: number
  /** fraction of outputs that needed human edits, 0..1 (lower is better) */
  editRate?: number
  /** number of eval cases behind these metrics */
  sampleSize: number
}

export type RoutingEvalPolicy = {
  /** minimum eval cases required to trust the candidate. Default 20. */
  minSampleSize?: number
  /** candidate passRate may be at most this much below baseline. Default 0.05. */
  maxPassRateRegression?: number
  /** absolute ceiling on candidate editRate (if provided). Default 0.20. */
  maxEditRate?: number
  /** absolute floor on candidate groundedness (if the metric is provided). Optional. */
  minGroundedness?: number
}

export type RoutingGateDecision = {
  allowed: boolean
  /** human-readable block reasons; empty when allowed. */
  reasons: string[]
}

const DEFAULTS = {
  minSampleSize: 20,
  maxPassRateRegression: 0.05,
  maxEditRate: 0.2,
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}

/**
 * Decide whether `candidate` (e.g. a local/cheap model) may take over from `baseline`
 * (e.g. frontier) for a task class, under `policy`.
 */
export function evaluateRoutingGate(
  baseline: RoutingEvalMetrics,
  candidate: RoutingEvalMetrics,
  policy: RoutingEvalPolicy = {},
): RoutingGateDecision {
  const minSampleSize = policy.minSampleSize ?? DEFAULTS.minSampleSize
  const maxPassRateRegression = policy.maxPassRateRegression ?? DEFAULTS.maxPassRateRegression
  const maxEditRate = policy.maxEditRate ?? DEFAULTS.maxEditRate
  const reasons: string[] = []

  if (candidate.sampleSize < minSampleSize) {
    reasons.push(`insufficient eval sample: ${candidate.sampleSize} < ${minSampleSize}`)
  }

  const regression = baseline.passRate - candidate.passRate
  if (regression > maxPassRateRegression) {
    reasons.push(
      `passRate regression ${round(regression)} exceeds allowed ${maxPassRateRegression}`,
    )
  }

  if (typeof candidate.editRate === 'number' && candidate.editRate > maxEditRate) {
    reasons.push(`editRate ${round(candidate.editRate)} exceeds ceiling ${maxEditRate}`)
  }

  if (
    typeof policy.minGroundedness === 'number' &&
    typeof candidate.groundedness === 'number' &&
    candidate.groundedness < policy.minGroundedness
  ) {
    reasons.push(
      `groundedness ${round(candidate.groundedness)} below floor ${policy.minGroundedness}`,
    )
  }

  return { allowed: reasons.length === 0, reasons }
}
