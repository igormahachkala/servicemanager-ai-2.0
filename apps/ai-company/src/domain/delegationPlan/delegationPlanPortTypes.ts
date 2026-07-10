/**
 * DelegationPlan persistence port — integration point for AI-COMPANY-112D.
 * Chat bridge (112E) writes through this port only; no duplicate domain storage.
 */

import type { DelegationPlan } from '../delegationEngine/delegationEngineTypes'

export const DELEGATION_PLAN_RECORD_STATUSES = [
  'proposed',
  'approved',
  'rejected',
  'overridden',
  'cancelled',
  'keep_max',
  'awaiting_execution',
] as const

export type DelegationPlanRecordStatus = (typeof DELEGATION_PLAN_RECORD_STATUSES)[number]

export type DelegationPlanRecord = {
  id: string
  plan: DelegationPlan
  chatMessageId: string | null
  chatSessionEmployeeId: string
  selectedEmployeeId: string
  status: DelegationPlanRecordStatus
  createdAt: string
  updatedAt: string
}

export type SaveDelegationPlanRecordInput = {
  plan: DelegationPlan
  chatMessageId: string | null
  chatSessionEmployeeId: string
  selectedEmployeeId: string
  status: DelegationPlanRecordStatus
}

export type DelegationPlanPersistencePort = {
  save: (input: SaveDelegationPlanRecordInput) => DelegationPlanRecord
  getById: (id: string) => DelegationPlanRecord | null
  getByChatMessageId: (chatMessageId: string) => DelegationPlanRecord | null
  list: () => DelegationPlanRecord[]
}
