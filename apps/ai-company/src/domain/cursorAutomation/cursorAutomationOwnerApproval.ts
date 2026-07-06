/**
 * Owner Approval Gate for Cursor Automation (AI-COMPANY-098A).
 * Persisted decisions — no Cursor API, no shell/git.
 */

export const CURSOR_AUTOMATION_OWNER_APPROVAL_STATUSES = [
  'pending',
  'approved',
  'rejected',
] as const

export type CursorAutomationOwnerApprovalStatus =
  (typeof CURSOR_AUTOMATION_OWNER_APPROVAL_STATUSES)[number]

export type CursorAutomationOwnerApprovalRecord = {
  id: string
  maxWorkerLoopId: string
  runtimeRunId: string | null
  handoffId: string | null
  status: CursorAutomationOwnerApprovalStatus
  createdAt: string
  updatedAt: string
  decidedAt: string | null
  decidedBy: 'owner' | null
  rejectionReason: string | null
}

const STORAGE_KEY = 'ai-company-cursor-automation-owner-approvals'

export const CURSOR_AUTOMATION_OWNER_APPROVAL_SYNC_EVENT =
  'ai-company-cursor-automation-owner-approval-sync'

function nowIso(): string {
  return new Date().toISOString()
}

function createApprovalId(): string {
  return `cursor-approval-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseRecord(value: unknown): CursorAutomationOwnerApprovalRecord | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.maxWorkerLoopId !== 'string') return null
  const status = value.status
  if (
    status !== 'pending' &&
    status !== 'approved' &&
    status !== 'rejected'
  ) {
    return null
  }
  return value as CursorAutomationOwnerApprovalRecord
}

export function loadCursorAutomationOwnerApprovals(): CursorAutomationOwnerApprovalRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseRecord).filter((item): item is CursorAutomationOwnerApprovalRecord => item !== null)
  } catch {
    return []
  }
}

function saveCursorAutomationOwnerApprovals(
  records: CursorAutomationOwnerApprovalRecord[],
): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  window.dispatchEvent(new Event(CURSOR_AUTOMATION_OWNER_APPROVAL_SYNC_EVENT))
}

export function getCursorAutomationOwnerApprovalByLoopId(
  maxWorkerLoopId: string,
): CursorAutomationOwnerApprovalRecord | null {
  return (
    loadCursorAutomationOwnerApprovals().find((item) => item.maxWorkerLoopId === maxWorkerLoopId) ??
    null
  )
}

export function getOrCreateCursorAutomationOwnerApproval(params: {
  maxWorkerLoopId: string
  runtimeRunId: string | null
  handoffId: string | null
}): CursorAutomationOwnerApprovalRecord {
  const existing = getCursorAutomationOwnerApprovalByLoopId(params.maxWorkerLoopId)
  if (existing) return existing

  const now = nowIso()
  const record: CursorAutomationOwnerApprovalRecord = {
    id: createApprovalId(),
    maxWorkerLoopId: params.maxWorkerLoopId,
    runtimeRunId: params.runtimeRunId,
    handoffId: params.handoffId,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    decidedAt: null,
    decidedBy: null,
    rejectionReason: null,
  }

  const records = loadCursorAutomationOwnerApprovals()
  records.unshift(record)
  saveCursorAutomationOwnerApprovals(records)
  return record
}

function upsertRecord(record: CursorAutomationOwnerApprovalRecord): CursorAutomationOwnerApprovalRecord {
  const records = loadCursorAutomationOwnerApprovals()
  const index = records.findIndex((item) => item.id === record.id)
  if (index >= 0) {
    records[index] = record
  } else {
    records.unshift(record)
  }
  saveCursorAutomationOwnerApprovals(records)
  return record
}

export function approveCursorAutomationOwnerGate(
  maxWorkerLoopId: string,
): CursorAutomationOwnerApprovalRecord | null {
  const record = getCursorAutomationOwnerApprovalByLoopId(maxWorkerLoopId)
  if (!record || record.status !== 'pending') return record

  const now = nowIso()
  return upsertRecord({
    ...record,
    status: 'approved',
    decidedAt: now,
    decidedBy: 'owner',
    updatedAt: now,
    rejectionReason: null,
  })
}

export function rejectCursorAutomationOwnerGate(
  maxWorkerLoopId: string,
  rejectionReason?: string,
): CursorAutomationOwnerApprovalRecord | null {
  const record = getCursorAutomationOwnerApprovalByLoopId(maxWorkerLoopId)
  if (!record || record.status !== 'pending') return record

  const now = nowIso()
  return upsertRecord({
    ...record,
    status: 'rejected',
    decidedAt: now,
    decidedBy: 'owner',
    updatedAt: now,
    rejectionReason: rejectionReason?.trim() || 'Owner отклонил отправку в Cursor Automation.',
  })
}
