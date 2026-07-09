/**
 * Structured Work Item payload — mobile complex task flow (AI-COMPANY-109A).
 * Stored on WorkItem in localStorage; backward-compatible optional field.
 */

export const WORK_ITEM_STRUCTURED_PAYLOAD_VERSION = 'v1' as const

export type WorkItemTaskMode = 'quick' | 'complex'

export type WorkItemStructuredPayload = {
  version: typeof WORK_ITEM_STRUCTURED_PAYLOAD_VERSION
  mode: WorkItemTaskMode
  templateId?: string | null
  objective?: string | null
  context?: string | null
  expectedResult?: string | null
  constraints?: string | null
  forbidden?: string | null
  deadline?: string | null
  needsReport?: boolean
  needsNextSteps?: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function parseWorkItemStructuredPayload(value: unknown): WorkItemStructuredPayload | null {
  if (!isRecord(value)) return null
  if (value.version !== WORK_ITEM_STRUCTURED_PAYLOAD_VERSION) return null
  if (value.mode !== 'quick' && value.mode !== 'complex') return null

  return {
    version: WORK_ITEM_STRUCTURED_PAYLOAD_VERSION,
    mode: value.mode,
    templateId: typeof value.templateId === 'string' ? value.templateId : null,
    objective: typeof value.objective === 'string' ? value.objective : null,
    context: typeof value.context === 'string' ? value.context : null,
    expectedResult: typeof value.expectedResult === 'string' ? value.expectedResult : null,
    constraints: typeof value.constraints === 'string' ? value.constraints : null,
    forbidden: typeof value.forbidden === 'string' ? value.forbidden : null,
    deadline: typeof value.deadline === 'string' ? value.deadline : null,
    needsReport: typeof value.needsReport === 'boolean' ? value.needsReport : undefined,
    needsNextSteps: typeof value.needsNextSteps === 'boolean' ? value.needsNextSteps : undefined,
  }
}
