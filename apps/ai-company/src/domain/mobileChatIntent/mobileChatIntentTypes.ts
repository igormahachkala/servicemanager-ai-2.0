import type { WorkPriority } from '../employeeWorkQueue'
import type { WorkItemStructuredPayload } from '../employeeWorkQueue/workItemStructuredPayload'

export const MOBILE_CHAT_INTENT_KINDS = [
  'casual_question',
  'simple_question',
  'task_request',
  'complex_task_request',
  'cursor_handoff_request',
  'report_request',
  'unclear',
] as const

export type MobileChatIntentKind = (typeof MOBILE_CHAT_INTENT_KINDS)[number]

export type MobileChatIntentSource = 'heuristic' | 'ollama' | 'ollama_fallback'

export type MobileChatIntentResult = {
  kind: MobileChatIntentKind
  confidence: number
  source: MobileChatIntentSource
  rationale: string | null
}

export type MobileChatTaskProposal = {
  title: string
  taskText: string
  priority: WorkPriority
  expectedResult: string
  structuredPayload: WorkItemStructuredPayload | null
  sourceMessage: string
  intent: MobileChatIntentKind
}

export function isMobileChatIntentKind(value: string): value is MobileChatIntentKind {
  return (MOBILE_CHAT_INTENT_KINDS as readonly string[]).includes(value)
}

export function shouldProposeTaskFromIntent(kind: MobileChatIntentKind): boolean {
  return (
    kind === 'task_request' ||
    kind === 'complex_task_request' ||
    kind === 'cursor_handoff_request' ||
    kind === 'report_request'
  )
}
