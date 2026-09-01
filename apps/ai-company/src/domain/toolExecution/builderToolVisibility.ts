/**
 * Owner-facing visibility of builder runs.
 *
 * `builderToolDecisionId` is filled by the cursor decision flow alone
 * (`builderToolRequestBridge`), yet the UI read it as "this run is showable":
 * the approval list, the Builder status card and the chat timeline all filtered
 * on it. An ollama run has `null` there and vanished from every one of them.
 *
 * The proxy is replaced here by the question it stood for, asked per tool, so
 * the condition is loosened for one tool instead of for everything.
 */

import { getToolCapability } from '../toolDispatcher/toolDispatcherRegistry'
import {
  TOOL_DISPATCHER_TOOL_IDS,
  type ToolDispatcherToolId,
} from '../toolDispatcher/toolDispatcherTypes'
import type { ToolExecutionRun } from './toolExecutionRunTypes'

/**
 * Tools whose Owner-facing item is not backed by a BuilderToolDecision. Ollama
 * is here because its capability produces no decision record: title,
 * instructions, fileScope and checks live in the run itself, put there by the
 * dispatcher. A tool absent from this set keeps the historical rule — no
 * decision, no item.
 */
const DECISION_FREE_TOOL_IDS: ReadonlySet<string> = new Set<string>(['ollama'])

export function requiresBuilderToolDecision(toolId: string): boolean {
  return !DECISION_FREE_TOOL_IDS.has(toolId)
}

/**
 * Visible when the tool needs no decision, or when a decision is linked.
 * Whether that link still resolves is the caller's business: the status card
 * does not need the decision, the approval list cannot render without it.
 */
export function isOwnerVisibleBuilderRun(run: ToolExecutionRun): boolean {
  return run.builderToolDecisionId !== null || !requiresBuilderToolDecision(run.toolId)
}

function isToolDispatcherToolId(toolId: string): toolId is ToolDispatcherToolId {
  return (TOOL_DISPATCHER_TOOL_IDS as readonly string[]).includes(toolId)
}

/**
 * Capability label for a run's tool, or `null` for an id the dispatcher does
 * not know. `ToolExecutionRun.toolId` is a plain string — a stored run may
 * carry an id that has since left the registry — so the narrowing happens here
 * rather than at every call site.
 */
export function resolveToolExecutionToolLabel(toolId: string): string | null {
  if (!isToolDispatcherToolId(toolId)) return null
  return getToolCapability(toolId)?.label ?? null
}
