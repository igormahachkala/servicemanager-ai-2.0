import { parseCollaborationDecision, type CollaborationDecision } from './collaborationDecision'
import { parseCollaborationMessage, type CollaborationMessage } from './collaborationMessage'

export type CollaborationStatus =
  | 'started'
  | 'discussing'
  | 'research'
  | 'review'
  | 'consensus'
  | 'completed'

export const COLLABORATION_STATUSES: readonly CollaborationStatus[] = [
  'started',
  'discussing',
  'research',
  'review',
  'consensus',
  'completed',
]

export type CollaborationParticipant = {
  employeeId: string
  codename: string
  role: string
  joinedAt: string
}

export type CollaborationArtifactKind =
  | 'report'
  | 'knowledge'
  | 'runtime'
  | 'project'
  | 'decision'

export type CollaborationArtifact = {
  id: string
  kind: CollaborationArtifactKind
  label: string
  refId?: string
  href?: string
}

export type CollaborationSession = {
  id: string
  title: string
  goal: string
  status: CollaborationStatus
  projectId?: string
  workspaceId?: string
  reportId?: string
  knowledgeId?: string
  runtimeRunId?: string
  participants: CollaborationParticipant[]
  messages: CollaborationMessage[]
  decisions: CollaborationDecision[]
  finalDecisionId?: string
  artifacts: CollaborationArtifact[]
  observerNote?: string
  createdAt: string
  updatedAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseStatus(value: unknown): CollaborationStatus {
  if (
    value === 'started' ||
    value === 'discussing' ||
    value === 'research' ||
    value === 'review' ||
    value === 'consensus' ||
    value === 'completed'
  ) {
    return value
  }
  return 'started'
}

function parseParticipant(value: unknown): CollaborationParticipant | null {
  if (!isRecord(value)) return null
  if (
    typeof value.employeeId !== 'string' ||
    typeof value.codename !== 'string' ||
    typeof value.role !== 'string' ||
    typeof value.joinedAt !== 'string'
  ) {
    return null
  }
  return {
    employeeId: value.employeeId,
    codename: value.codename,
    role: value.role,
    joinedAt: value.joinedAt,
  }
}

function parseArtifactKind(value: unknown): CollaborationArtifactKind {
  if (
    value === 'report' ||
    value === 'knowledge' ||
    value === 'runtime' ||
    value === 'project' ||
    value === 'decision'
  ) {
    return value
  }
  return 'decision'
}

function parseArtifact(value: unknown): CollaborationArtifact | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.label !== 'string') return null
  return {
    id: value.id,
    kind: parseArtifactKind(value.kind),
    label: value.label,
    refId: typeof value.refId === 'string' ? value.refId : undefined,
    href: typeof value.href === 'string' ? value.href : undefined,
  }
}

export function parseCollaborationSession(value: unknown): CollaborationSession | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.goal !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }

  const participants = Array.isArray(value.participants)
    ? value.participants
        .map(parseParticipant)
        .filter((item): item is CollaborationParticipant => item !== null)
    : []

  const messages = Array.isArray(value.messages)
    ? value.messages
        .map(parseCollaborationMessage)
        .filter((item): item is CollaborationMessage => item !== null)
    : []

  const decisions = Array.isArray(value.decisions)
    ? value.decisions
        .map(parseCollaborationDecision)
        .filter((item): item is CollaborationDecision => item !== null)
    : []

  const artifacts = Array.isArray(value.artifacts)
    ? value.artifacts.map(parseArtifact).filter((item): item is CollaborationArtifact => item !== null)
    : []

  return {
    id: value.id,
    title: value.title,
    goal: value.goal,
    status: parseStatus(value.status),
    projectId: typeof value.projectId === 'string' ? value.projectId : undefined,
    workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId : undefined,
    reportId: typeof value.reportId === 'string' ? value.reportId : undefined,
    knowledgeId: typeof value.knowledgeId === 'string' ? value.knowledgeId : undefined,
    runtimeRunId: typeof value.runtimeRunId === 'string' ? value.runtimeRunId : undefined,
    participants,
    messages,
    decisions,
    finalDecisionId: typeof value.finalDecisionId === 'string' ? value.finalDecisionId : undefined,
    artifacts,
    observerNote: typeof value.observerNote === 'string' ? value.observerNote : undefined,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

export function createCollaborationSession(
  input: Omit<CollaborationSession, 'createdAt' | 'updatedAt'> & {
    createdAt?: string
    updatedAt?: string
  },
): CollaborationSession {
  const now = input.createdAt ?? new Date().toISOString()
  return {
    ...input,
    createdAt: now,
    updatedAt: input.updatedAt ?? now,
  }
}

export function getFinalDecision(session: CollaborationSession): CollaborationDecision | null {
  if (!session.finalDecisionId) return null
  return session.decisions.find((item) => item.id === session.finalDecisionId) ?? null
}

export function statusProgressIndex(status: CollaborationStatus): number {
  return COLLABORATION_STATUSES.indexOf(status)
}
