import type { RuntimeContext } from './runtimeContext'
import type { RuntimeRunRequest } from './runtimeOrchestrator'
import type { OutputLanguage } from './runtimeOutputPolicy'

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
  employeePersona: string
  languagePolicy: string
  task: string
  context: string
  instructions: string
}

export type RuntimePromptPreview = RuntimePromptSections & {
  finalPrompt: string
  explicitOverride: boolean
  outputLanguage: OutputLanguage
  projectLabel: string | null
  workspaceLabel: string | null
}
