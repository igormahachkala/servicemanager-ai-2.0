export type CollaborationMessageKind =
  | 'question'
  | 'answer'
  | 'comment'
  | 'issue'
  | 'suggestion'
  | 'consensus'

export const COLLABORATION_MESSAGE_KINDS: readonly CollaborationMessageKind[] = [
  'question',
  'answer',
  'comment',
  'issue',
  'suggestion',
  'consensus',
]

export type CollaborationMessage = {
  id: string
  sessionId: string
  employeeId: string
  authorCodename: string
  authorRole: string
  kind: CollaborationMessageKind
  content: string
  replyToId?: string
  createdAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseKind(value: unknown): CollaborationMessageKind {
  if (
    value === 'question' ||
    value === 'answer' ||
    value === 'comment' ||
    value === 'issue' ||
    value === 'suggestion' ||
    value === 'consensus'
  ) {
    return value
  }
  return 'comment'
}

export function parseCollaborationMessage(value: unknown): CollaborationMessage | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.sessionId !== 'string' ||
    typeof value.employeeId !== 'string' ||
    typeof value.authorCodename !== 'string' ||
    typeof value.authorRole !== 'string' ||
    typeof value.content !== 'string' ||
    typeof value.createdAt !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    sessionId: value.sessionId,
    employeeId: value.employeeId,
    authorCodename: value.authorCodename,
    authorRole: value.authorRole,
    kind: parseKind(value.kind),
    content: value.content,
    replyToId: typeof value.replyToId === 'string' ? value.replyToId : undefined,
    createdAt: value.createdAt,
  }
}

export function createCollaborationMessage(
  input: Omit<CollaborationMessage, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
): CollaborationMessage {
  return {
    id: input.id ?? `cmsg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sessionId: input.sessionId,
    employeeId: input.employeeId,
    authorCodename: input.authorCodename.trim(),
    authorRole: input.authorRole.trim(),
    kind: input.kind,
    content: input.content.trim(),
    replyToId: input.replyToId,
    createdAt: input.createdAt ?? new Date().toISOString(),
  }
}
