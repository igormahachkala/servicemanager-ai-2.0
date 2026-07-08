/** Mobile AI Company demo scenario — 7-step Owner loop (AI-COMPANY-108B). */

export const MOBILE_DEMO_STEP_IDS = [
  'today',
  'assign_task',
  'max_executes',
  'runtime_live',
  'report',
  'owner_decision',
  'company_updated',
] as const

export type MobileDemoStepId = (typeof MOBILE_DEMO_STEP_IDS)[number]

export type MobileDemoStepStatus = 'pending' | 'current' | 'completed'

export type MobileDemoStepDef = {
  id: MobileDemoStepId
  order: number
}

export const MOBILE_DEMO_STEPS: MobileDemoStepDef[] = MOBILE_DEMO_STEP_IDS.map((id, index) => ({
  id,
  order: index + 1,
}))
