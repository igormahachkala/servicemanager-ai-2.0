import type { RuntimeContext } from './runtimeContext'
import type { RuntimeRunRequest } from './runtimeOrchestrator'

export type RuntimePromptBuildInput = {
  request: RuntimeRunRequest
  employee: {
    employeeId: string
    codename: string
    role: string
  }
  context: RuntimeContext
}

export type RuntimePromptSections = {
  systemPrompt: string
  employeeIdentity: string
  task: string
  context: string
  instructions: string
}

export type RuntimePromptPreview = RuntimePromptSections & {
  finalPrompt: string
  explicitOverride: boolean
  projectLabel: string | null
  workspaceLabel: string | null
}
