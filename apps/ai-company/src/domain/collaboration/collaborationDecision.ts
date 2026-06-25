export type CollaborationDecisionStatus = 'proposed' | 'accepted' | 'rejected' | 'superseded' | 'final'

export const COLLABORATION_DECISION_STATUSES: readonly CollaborationDecisionStatus[] = [
  'proposed',
  'accepted',
  'rejected',
  'superseded',
  'final',
]

export type CollaborationVote = {
  employeeId: string
  codename: string
  vote: 'approve' | 'reject' | 'abstain'
}

export type CollaborationDecision = {
  id: string
  sessionId: string
  proposedByEmployeeId: string
  proposedByCodename: string
  title: string
  summary: string
  status: CollaborationDecisionStatus
  votes: CollaborationVote[]
  createdAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseStatus(value: unknown): CollaborationDecisionStatus {
  if (
    value === 'proposed' ||
    value === 'accepted' ||
    value === 'rejected' ||
    value === 'superseded' ||
    value === 'final'
  ) {
    return value
  }
  return 'proposed'
}

function parseVote(value: unknown): CollaborationVote | null {
  if (!isRecord(value)) return null
  if (typeof value.employeeId !== 'string' || typeof value.codename !== 'string') return null
  const vote =
    value.vote === 'approve' || value.vote === 'reject' || value.vote === 'abstain'
      ? value.vote
      : 'abstain'
  return { employeeId: value.employeeId, codename: value.codename, vote }
}

export function parseCollaborationDecision(value: unknown): CollaborationDecision | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.sessionId !== 'string' ||
    typeof value.proposedByEmployeeId !== 'string' ||
    typeof value.proposedByCodename !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.summary !== 'string' ||
    typeof value.createdAt !== 'string'
  ) {
    return null
  }

  const votes = Array.isArray(value.votes)
    ? value.votes.map(parseVote).filter((item): item is CollaborationVote => item !== null)
    : []

  return {
    id: value.id,
    sessionId: value.sessionId,
    proposedByEmployeeId: value.proposedByEmployeeId,
    proposedByCodename: value.proposedByCodename,
    title: value.title,
    summary: value.summary,
    status: parseStatus(value.status),
    votes,
    createdAt: value.createdAt,
  }
}

export function createCollaborationDecision(
  input: Omit<CollaborationDecision, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
): CollaborationDecision {
  return {
    id: input.id ?? `cdec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sessionId: input.sessionId,
    proposedByEmployeeId: input.proposedByEmployeeId,
    proposedByCodename: input.proposedByCodename,
    title: input.title.trim(),
    summary: input.summary.trim(),
    status: input.status,
    votes: input.votes,
    createdAt: input.createdAt ?? new Date().toISOString(),
  }
}

export function countApprovals(decision: CollaborationDecision): number {
  return decision.votes.filter((item) => item.vote === 'approve').length
}
