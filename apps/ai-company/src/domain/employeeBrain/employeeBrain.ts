/**
 * Employee Brain V1 — aggregate shape (AI-COMPANY-101D).
 *
 * Brain — слой принятия решений цифрового сотрудника.
 * Хранит policy и preferences; не исполняет inference и не хранит опыт/знания.
 */

import { EMPLOYEE_BRAIN_V1_VERSION } from './employeeBrainTypes'
import type {
  BrainAutonomyLevel,
  BrainConstraints,
  BrainDecisionProfile,
  BrainModelSelectionStrategy,
  BrainReasoningPreferences,
  BrainRiskTolerance,
  BrainSpecialization,
  BrainToolSelectionStrategy,
} from './employeeBrainTypes'

export type EmployeeBrainId = `brain-${string}`

/** Canonical Brain record — one per Employee in V1. */
export type EmployeeBrainV1 = {
  version: typeof EMPLOYEE_BRAIN_V1_VERSION
  id: EmployeeBrainId
  employeeId: string
  companyId: string | null
  specialization: BrainSpecialization
  decisionProfile: BrainDecisionProfile
  modelStrategy: BrainModelSelectionStrategy
  toolStrategy: BrainToolSelectionStrategy
  autonomyLevel: BrainAutonomyLevel
  acceptableRisk: BrainRiskTolerance
  reasoningPreferences: BrainReasoningPreferences
  constraints: BrainConstraints
  createdAt: string
  updatedAt: string
}

export type CreateEmployeeBrainInput = {
  employeeId: string
  companyId?: string | null
  specialization: BrainSpecialization
  decisionProfile: BrainDecisionProfile
  modelStrategy: BrainModelSelectionStrategy
  toolStrategy: BrainToolSelectionStrategy
  autonomyLevel: BrainAutonomyLevel
  acceptableRisk: BrainRiskTolerance
  reasoningPreferences: BrainReasoningPreferences
  constraints: BrainConstraints
}

export type UpdateEmployeeBrainInput = Partial<
  Omit<EmployeeBrainV1, 'id' | 'employeeId' | 'version' | 'createdAt' | 'updatedAt'>
>

/** Invariants — documented for Runtime integration in 101E+. */
export const EMPLOYEE_BRAIN_INVARIANTS = [
  'Brain is not an LLM runtime — it does not invoke models.',
  'Brain is not Memory — it does not store experiential records from Runs.',
  'Brain is not Knowledge — it does not store company corpus or workspace docs.',
  'One Brain per Employee id in V1.',
  'Brain autonomy cannot exceed Owner approval policy or Permission grants.',
  'Model/tool strategies are hints — Runtime Router and Tool Registry enforce gates.',
] as const

export function buildEmployeeBrainId(employeeId: string): EmployeeBrainId {
  return `brain-${employeeId}`
}

export function isEmployeeBrainId(value: string): value is EmployeeBrainId {
  return value.startsWith('brain-') && value.length > 'brain-'.length
}
