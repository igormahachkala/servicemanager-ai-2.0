/**
 * ToolExecutionRun execution route — resolve/assign without migration (AI-COMPANY-111).
 */

import type { ExecutionRoute } from '../cursorExecutionRoute/cursorExecutionRouteTypes'
import { getToolDispatcherResultByRequestId } from '../toolDispatcher/toolDispatcherStorage'
import {
  getToolExecutionRun,
  upsertToolExecutionRun,
} from '../toolExecution/toolExecutionRunStorage'
import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readRouteFromOutput(output: Record<string, unknown>): ExecutionRoute | null {
  if (output.executionRoute === 'MANUAL_CLOUD_AGENT') return 'MANUAL_CLOUD_AGENT'
  if (output.executionRoute === 'LOCAL_CURSOR_BRIDGE') return 'LOCAL_CURSOR_BRIDGE'
  if (output.executionRoute === 'CURSOR_AUTOMATION_WEBHOOK') return 'CURSOR_AUTOMATION_WEBHOOK'

  const envelope = output.cursorResultEnvelopeV110
  if (isRecord(envelope) && typeof envelope.route === 'string') {
    const route = envelope.route
    if (
      route === 'MANUAL_CLOUD_AGENT' ||
      route === 'LOCAL_CURSOR_BRIDGE' ||
      route === 'CURSOR_AUTOMATION_WEBHOOK'
    ) {
      return route
    }
  }

  const routeDecision = output.routeDecision
  if (isRecord(routeDecision) && typeof routeDecision.selectedRoute === 'string') {
    return routeDecision.selectedRoute as ExecutionRoute
  }

  if (typeof output.selectedExecutionRoute === 'string') {
    return output.selectedExecutionRoute as ExecutionRoute
  }

  return null
}

export function resolveToolExecutionRunExecutionRoute(run: ToolExecutionRun): ExecutionRoute | null {
  const output = run.result?.output
  if (output && isRecord(output)) {
    const fromResult = readRouteFromOutput(output)
    if (fromResult) return fromResult
  }

  const dispatcherResult = getToolDispatcherResultByRequestId(run.toolRequestId)
  const dispatcherOutput = dispatcherResult?.output
  if (dispatcherOutput && isRecord(dispatcherOutput)) {
    return readRouteFromOutput(dispatcherOutput)
  }

  return null
}

export function assignToolExecutionRunExecutionRoute(
  runId: string,
  route: ExecutionRoute,
): ToolExecutionRun | null {
  const existing = getToolExecutionRun(runId)
  if (!existing) return null

  const priorOutput = isRecord(existing.result?.output) ? existing.result.output : {}
  const nextOutput = {
    ...priorOutput,
    executionRoute: route,
  }

  return upsertToolExecutionRun({
    ...existing,
    result: {
      plannedOnly: true,
      output: nextOutput,
      deliveryMode: existing.result?.deliveryMode ?? 'cursor_v1',
      cursorAutomationTaskId: existing.result?.cursorAutomationTaskId ?? null,
      registryInvokePlanId: existing.result?.registryInvokePlanId ?? null,
      receivedAt: existing.result?.receivedAt ?? null,
    },
    updatedAt: new Date().toISOString(),
  })
}
