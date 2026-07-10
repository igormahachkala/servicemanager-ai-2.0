import type {
  EmployeeBrainAutonomyLevel,
  EmployeeBrainDecisionStyle,
  EmployeeBrainModelStrategy,
  EmployeeBrainProfile,
  EmployeeBrainRiskLevel,
  EmployeeBrainToolStrategy,
} from './employeeBrainProfile'
import { EMPLOYEE_BRAIN_VERSION, createEmployeeBrainProfileId } from './employeeBrainProfile'

type BrainPreset = {
  specialization: string
  decisionStyle: EmployeeBrainDecisionStyle
  modelSelectionStrategy: EmployeeBrainModelStrategy
  toolSelectionStrategy: EmployeeBrainToolStrategy
  autonomyLevel: EmployeeBrainAutonomyLevel
  acceptableRisk: EmployeeBrainRiskLevel
  reasoningLevel: EmployeeBrainProfile['reasoningPreferences']['level']
  preferVerification: boolean
  constraints: string[]
  ownerApprovalTriggers: string[]
}

const BRAIN_PRESET_CATALOG: Record<string, BrainPreset> = {
  'ag-max': {
    specialization: 'Technical implementation, audit, MVP fixes, Codex handoff',
    decisionStyle: 'pragmatic',
    modelSelectionStrategy: 'multi_step',
    toolSelectionStrategy: 'external_when_needed',
    autonomyLevel: 'guided',
    acceptableRisk: 'medium',
    reasoningLevel: 'standard',
    preferVerification: true,
    constraints: [
      'Не менять apps/ai-company без отдельной задачи Owner',
      'Product repos — через Codex / Cursor Automation после Owner Approval',
      'Без production deploy и git push без Owner',
    ],
    ownerApprovalTriggers: ['git_push', 'cursor_automation', 'terminal', 'docker', 'production'],
  },
  'ag-builder': {
    specialization: 'Product implementation, UI flows, local feature delivery',
    decisionStyle: 'pragmatic',
    modelSelectionStrategy: 'single_best',
    toolSelectionStrategy: 'minimal',
    autonomyLevel: 'guided',
    acceptableRisk: 'low',
    reasoningLevel: 'standard',
    preferVerification: true,
    constraints: [
      'Локальная работа V1 — без Worker Loop и Tool Dispatcher',
      'Задачи в Work Queue; Owner подтверждает proposal в чате',
      'Без Cursor handoff и production deploy',
    ],
    ownerApprovalTriggers: ['production', 'git_push'],
  },
  'ag-cto': {
    specialization: 'Architecture, planning, risk assessment, Owner decisions',
    decisionStyle: 'conservative',
    modelSelectionStrategy: 'fast_first',
    toolSelectionStrategy: 'minimal',
    autonomyLevel: 'supervised',
    acceptableRisk: 'low',
    reasoningLevel: 'deep',
    preferVerification: true,
    constraints: [
      'Не пишет production-код в product repos',
      'Фокус на trade-offs и инварианты multi-tenant',
    ],
    ownerApprovalTriggers: ['write_code', 'cursor_automation', 'production', 'git_push'],
  },
  'ag-qa': {
    specialization: 'QA scenarios, acceptance criteria, demo readiness',
    decisionStyle: 'balanced',
    modelSelectionStrategy: 'single_best',
    toolSelectionStrategy: 'registry_first',
    autonomyLevel: 'guided',
    acceptableRisk: 'medium',
    reasoningLevel: 'standard',
    preferVerification: true,
    constraints: ['Не пишет product-код', 'Playwright / browser checks только с Owner Approval'],
    ownerApprovalTriggers: ['playwright', 'write_code', 'production'],
  },
}

const DEFAULT_PRESET: BrainPreset = {
  specialization: 'General digital employee work within assigned scope',
  decisionStyle: 'balanced',
  modelSelectionStrategy: 'single_best',
  toolSelectionStrategy: 'registry_first',
  autonomyLevel: 'supervised',
  acceptableRisk: 'low',
  reasoningLevel: 'standard',
  preferVerification: false,
  constraints: ['Остаётся в scope Owner и assigned project', 'Owner Approval для high-risk tools'],
  ownerApprovalTriggers: ['production', 'git_push', 'cursor_automation'],
}

export function resolveEmployeeBrainPreset(employeeId: string): BrainPreset {
  return BRAIN_PRESET_CATALOG[employeeId] ?? DEFAULT_PRESET
}

export function buildDefaultEmployeeBrainProfile(employeeId: string, now = new Date()): EmployeeBrainProfile {
  const preset = resolveEmployeeBrainPreset(employeeId)
  const iso = now.toISOString()

  return {
    id: createEmployeeBrainProfileId(employeeId),
    employeeId,
    version: EMPLOYEE_BRAIN_VERSION,
    specialization: preset.specialization,
    decisionStyle: preset.decisionStyle,
    modelSelectionStrategy: preset.modelSelectionStrategy,
    toolSelectionStrategy: preset.toolSelectionStrategy,
    autonomyLevel: preset.autonomyLevel,
    acceptableRisk: preset.acceptableRisk,
    reasoningPreferences: {
      level: preset.reasoningLevel,
      preferVerification: preset.preferVerification,
      preferStructuredOutput: true,
    },
    constraints: [...preset.constraints],
    ownerApprovalTriggers: [...preset.ownerApprovalTriggers],
    createdAt: iso,
    updatedAt: iso,
  }
}

export function listEmployeeBrainPresetEmployeeIds(): string[] {
  return Object.keys(BRAIN_PRESET_CATALOG)
}
