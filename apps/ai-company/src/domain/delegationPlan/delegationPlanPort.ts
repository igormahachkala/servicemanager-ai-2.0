/**
 * DelegationPlan persistence port — local adapter until 112D storage ships.
 */

import type {
  DelegationPlanPersistencePort,
  DelegationPlanRecord,
  SaveDelegationPlanRecordInput,
} from './delegationPlanPortTypes'

export const DELEGATION_PLAN_PORT_STORAGE_KEY = 'ai-company-delegation-plan-records'

export const DELEGATION_PLAN_PORT_SYNC_EVENT = 'ai-company-delegation-plan-sync'

function nowIso(): string {
  return new Date().toISOString()
}

function emitSync(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(DELEGATION_PLAN_PORT_SYNC_EVENT))
}

function loadRecords(): DelegationPlanRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(DELEGATION_PLAN_PORT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as DelegationPlanRecord[]) : []
  } catch {
    return []
  }
}

function saveRecords(records: DelegationPlanRecord[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(DELEGATION_PLAN_PORT_STORAGE_KEY, JSON.stringify(records))
    emitSync()
  } catch {
    /* noop */
  }
}

const localDelegationPlanPort: DelegationPlanPersistencePort = {
  save(input: SaveDelegationPlanRecordInput): DelegationPlanRecord {
    const existing = loadRecords()
    const prior = input.chatMessageId
      ? existing.find((item) => item.chatMessageId === input.chatMessageId)
      : null
    const now = nowIso()
    const record: DelegationPlanRecord = {
      id: prior?.id ?? input.plan.id,
      plan: input.plan,
      chatMessageId: input.chatMessageId,
      chatSessionEmployeeId: input.chatSessionEmployeeId,
      selectedEmployeeId: input.selectedEmployeeId,
      status: input.status,
      createdAt: prior?.createdAt ?? now,
      updatedAt: now,
    }
    const next = [record, ...existing.filter((item) => item.id !== record.id)]
    saveRecords(next)
    return record
  },

  getById(id: string): DelegationPlanRecord | null {
    return loadRecords().find((item) => item.id === id) ?? null
  },

  getByChatMessageId(chatMessageId: string): DelegationPlanRecord | null {
    return loadRecords().find((item) => item.chatMessageId === chatMessageId) ?? null
  },

  list(): DelegationPlanRecord[] {
    return loadRecords()
  },
}

let activePort: DelegationPlanPersistencePort = localDelegationPlanPort

/** 112D can replace the active port without touching chat bridge code. */
export function setDelegationPlanPersistencePort(port: DelegationPlanPersistencePort): void {
  activePort = port
}

export function getDelegationPlanPersistencePort(): DelegationPlanPersistencePort {
  return activePort
}

export function saveDelegationPlanRecord(
  input: SaveDelegationPlanRecordInput,
): DelegationPlanRecord {
  return activePort.save(input)
}
