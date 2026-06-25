import type { CostPolicy, PrivacyPolicy } from './modelPolicy'
import type { ModelRoute } from './modelRoute'

export const RUNTIME_PROFILE_STATUSES = ['active', 'paused', 'draft'] as const
export type RuntimeProfileStatus = (typeof RUNTIME_PROFILE_STATUSES)[number]

export const REASONING_LEVELS = ['minimal', 'standard', 'deep'] as const
export type ReasoningLevel = (typeof REASONING_LEVELS)[number]

export type RuntimeProfile = {
  id: string
  employeeId: string
  primaryModelId: string
  fallbackModelIds: string[]
  allowedProviderIds: string[]
  routingRules: ModelRoute[]
  privacyPolicy: PrivacyPolicy
  costPolicy: CostPolicy
  reasoningLevel: ReasoningLevel
  temperature: number
  contextWindow: number
  maxTokens: number
  status: RuntimeProfileStatus
  createdAt: string
  updatedAt: string
}
