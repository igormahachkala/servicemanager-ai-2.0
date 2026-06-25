import { emitEvent } from '../events/eventStorage'
import {
  AI_PHOTO_LAB_PROJECT_ID,
  AI_PHOTO_LAB_WORKSPACE_ID,
} from '../projects/aiPhotoLabIds'
import { createCollaborationDecision } from './collaborationDecision'
import { createCollaborationMessage } from './collaborationMessage'
import {
  createCollaborationSession,
  getFinalDecision,
  parseCollaborationSession,
  type CollaborationSession,
  type CollaborationStatus,
} from './collaborationSession'

export type CollaborationFilter = {
  status?: CollaborationStatus | 'all'
  projectId?: string | null
  employeeId?: string | null
}

export type CollaborationStats = {
  total: number
  active: number
  consensus: number
  completed: number
  participants: number
  messages: number
}

const STORAGE_KEY = 'ai-company-collaboration'
const SEED_KEY = 'ai-company-collaboration-seeded-v1'
export const CHANGE_EVENT = 'ai-company-collaboration-change'

function notifyChange(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function loadRawSessions(): CollaborationSession[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(parseCollaborationSession)
      .filter((item): item is CollaborationSession => item !== null)
  } catch {
    return []
  }
}

function saveRawSessions(sessions: CollaborationSession[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
    notifyChange()
  } catch {
    /* noop */
  }
}

function seedPhotoLabSession(): CollaborationSession {
  const sessionId = 'collab-photo-lab-arch-review'
  const base = '2026-06-24T10:00:00.000Z'

  const participants = [
    { employeeId: 'ag-cto', codename: 'Atlas', role: 'AI CTO', joinedAt: base },
    { employeeId: 'ag-arch', codename: 'Daedalus', role: 'AI Architect', joinedAt: base },
    { employeeId: 'ag-max', codename: 'MAX', role: 'MAX Senior Developer', joinedAt: base },
    { employeeId: 'ag-qa', codename: 'Sentinel', role: 'AI QA', joinedAt: base },
    { employeeId: 'ag-devops', codename: 'Helm', role: 'AI DevOps', joinedAt: base },
  ]

  const messages = [
    createCollaborationMessage({
      id: 'cmsg-atlas-question',
      sessionId,
      employeeId: 'ag-cto',
      authorCodename: 'Atlas',
      authorRole: 'AI CTO',
      kind: 'question',
      content:
        'Daedalus, we need an architecture review for AI Photo Lab before MAX proceeds with frontend delivery. What layering do you recommend?',
      createdAt: '2026-06-24T10:02:00.000Z',
    }),
    createCollaborationMessage({
      id: 'cmsg-architect-answer',
      sessionId,
      employeeId: 'ag-arch',
      authorCodename: 'Daedalus',
      authorRole: 'AI Architect',
      kind: 'answer',
      content:
        'Use a layered React module: upload shell, analysis pipeline adapter, and report preview. Shared photo-analysis hooks should live in a domain package consumed by AI Company and Photo Lab.',
      replyToId: 'cmsg-atlas-question',
      createdAt: '2026-06-24T10:08:00.000Z',
    }),
    createCollaborationMessage({
      id: 'cmsg-max-comment',
      sessionId,
      employeeId: 'ag-max',
      authorCodename: 'MAX',
      authorRole: 'MAX Senior Developer',
      kind: 'comment',
      content:
        'I can align the component tree with existing AI Company patterns and reuse Runtime report artifacts for the preview step.',
      replyToId: 'cmsg-architect-answer',
      createdAt: '2026-06-24T10:14:00.000Z',
    }),
    createCollaborationMessage({
      id: 'cmsg-qa-issue',
      sessionId,
      employeeId: 'ag-qa',
      authorCodename: 'Sentinel',
      authorRole: 'AI QA',
      kind: 'issue',
      content:
        'We need explicit acceptance criteria for photo upload edge cases: empty file, oversize image, corrupt EXIF, and unsupported MIME types.',
      createdAt: '2026-06-24T10:20:00.000Z',
    }),
    createCollaborationMessage({
      id: 'cmsg-devops-suggestion',
      sessionId,
      employeeId: 'ag-devops',
      authorCodename: 'Helm',
      authorRole: 'AI DevOps',
      kind: 'suggestion',
      content:
        'Suggest staging deploy via Docker compose first. Keep production deploy behind Owner approval until QA matrix passes.',
      createdAt: '2026-06-24T10:26:00.000Z',
    }),
    createCollaborationMessage({
      id: 'cmsg-atlas-consensus',
      sessionId,
      employeeId: 'ag-cto',
      authorCodename: 'Atlas',
      authorRole: 'AI CTO',
      kind: 'consensus',
      content:
        'Consensus forming: staged architecture, shared hooks, QA matrix, and gated deploy. Owner can observe — no intervention required.',
      createdAt: '2026-06-24T10:32:00.000Z',
    }),
  ]

  const decisions = [
    createCollaborationDecision({
      id: 'cdec-shared-hooks',
      sessionId,
      proposedByEmployeeId: 'ag-arch',
      proposedByCodename: 'Daedalus',
      title: 'Adopt shared photo-analysis hooks',
      summary: 'Extract upload + analysis hooks into a shared domain package for Photo Lab and AI Company.',
      status: 'accepted',
      votes: [
        { employeeId: 'ag-cto', codename: 'Atlas', vote: 'approve' },
        { employeeId: 'ag-max', codename: 'MAX', vote: 'approve' },
        { employeeId: 'ag-qa', codename: 'Sentinel', vote: 'approve' },
        { employeeId: 'ag-devops', codename: 'Helm', vote: 'abstain' },
      ],
      createdAt: '2026-06-24T10:10:00.000Z',
    }),
    createCollaborationDecision({
      id: 'cdec-qa-matrix',
      sessionId,
      proposedByEmployeeId: 'ag-qa',
      proposedByCodename: 'Sentinel',
      title: 'Add upload edge-case test matrix',
      summary: 'Define acceptance criteria for empty, oversize, corrupt EXIF, and unsupported MIME uploads.',
      status: 'accepted',
      votes: [
        { employeeId: 'ag-cto', codename: 'Atlas', vote: 'approve' },
        { employeeId: 'ag-max', codename: 'MAX', vote: 'approve' },
        { employeeId: 'ag-arch', codename: 'Daedalus', vote: 'approve' },
      ],
      createdAt: '2026-06-24T10:22:00.000Z',
    }),
    createCollaborationDecision({
      id: 'cdec-final-consensus',
      sessionId,
      proposedByEmployeeId: 'ag-cto',
      proposedByCodename: 'Atlas',
      title: 'Proceed with staged architecture before production deploy',
      summary:
        'Team agrees on layered React module, shared hooks, QA matrix, and Docker staging deploy gated by Owner approval.',
      status: 'final',
      votes: [
        { employeeId: 'ag-arch', codename: 'Daedalus', vote: 'approve' },
        { employeeId: 'ag-max', codename: 'MAX', vote: 'approve' },
        { employeeId: 'ag-qa', codename: 'Sentinel', vote: 'approve' },
        { employeeId: 'ag-devops', codename: 'Helm', vote: 'approve' },
      ],
      createdAt: '2026-06-24T10:33:00.000Z',
    }),
  ]

  return createCollaborationSession({
    id: sessionId,
    title: 'AI Photo Lab — Architecture Review',
    goal: 'Align architecture, QA, and deployment approach before frontend delivery.',
    status: 'consensus',
    projectId: AI_PHOTO_LAB_PROJECT_ID,
    workspaceId: AI_PHOTO_LAB_WORKSPACE_ID,
    participants,
    messages,
    decisions,
    finalDecisionId: 'cdec-final-consensus',
    artifacts: [
      {
        id: 'cart-project',
        kind: 'project',
        label: 'AI Photo Lab project',
        refId: AI_PHOTO_LAB_PROJECT_ID,
        href: `/ops/projects/${AI_PHOTO_LAB_PROJECT_ID}`,
      },
      {
        id: 'cart-knowledge',
        kind: 'knowledge',
        label: 'Architecture ADR review',
        href: '/ops/knowledge',
      },
      {
        id: 'cart-runtime',
        kind: 'runtime',
        label: 'Runtime report draft',
        href: '/ops/reports',
      },
      {
        id: 'cart-decision',
        kind: 'decision',
        label: 'Final consensus decision',
        refId: 'cdec-final-consensus',
      },
    ],
    observerNote:
      'Owner observes this multi-agent thread. Employees coordinate autonomously — no Owner intervention required in V1 mock.',
    createdAt: base,
    updatedAt: '2026-06-24T10:33:00.000Z',
  })
}

function emitCollaborationSeedEvents(session: CollaborationSession): void {
  emitEvent({
    type: 'collaboration.started',
    sourceType: 'collaboration',
    sourceId: session.id,
    employeeId: session.participants[0]?.employeeId ?? null,
    workspaceId: session.workspaceId ?? null,
    reportId: session.reportId ?? null,
    metadata: {
      title: session.title,
      goal: session.goal,
      participantCount: session.participants.length,
    },
    severity: 'info',
  })

  const lastMessage = session.messages[session.messages.length - 1]
  if (lastMessage) {
    emitEvent({
      type: 'collaboration.message',
      sourceType: 'collaboration',
      sourceId: session.id,
      employeeId: lastMessage.employeeId,
      workspaceId: session.workspaceId ?? null,
      reportId: null,
      metadata: {
        title: session.title,
        preview: lastMessage.content.slice(0, 120),
        codename: lastMessage.authorCodename,
      },
      severity: 'info',
    })
  }

  const finalDecision = getFinalDecision(session)
  if (finalDecision) {
    emitEvent({
      type: 'collaboration.consensus',
      sourceType: 'collaboration',
      sourceId: session.id,
      employeeId: finalDecision.proposedByEmployeeId,
      workspaceId: session.workspaceId ?? null,
      reportId: null,
      metadata: {
        title: finalDecision.title,
        message: finalDecision.summary,
      },
      severity: 'success',
    })
  }
}

export function ensureSeedCollaborationSessions(): CollaborationSession[] {
  const existing = loadRawSessions()
  if (existing.length > 0) return existing

  if (typeof window !== 'undefined' && localStorage.getItem(SEED_KEY) === '1') {
    return existing
  }

  const seeded = [seedPhotoLabSession()]
  saveRawSessions(seeded)

  if (typeof window !== 'undefined') {
    localStorage.setItem(SEED_KEY, '1')
    emitCollaborationSeedEvents(seeded[0])
  }

  return seeded
}

export function loadCollaborationSessions(): CollaborationSession[] {
  const sessions = ensureSeedCollaborationSessions()
  return [...sessions].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  )
}

export function getCollaborationSessionById(id: string): CollaborationSession | null {
  return loadCollaborationSessions().find((item) => item.id === id) ?? null
}

export function readCollaborationStorageKey(): string {
  return STORAGE_KEY
}

export function buildCollaborationStats(sessions: CollaborationSession[]): CollaborationStats {
  const participantIds = new Set<string>()
  let messageCount = 0

  for (const session of sessions) {
    for (const participant of session.participants) {
      participantIds.add(participant.employeeId)
    }
    messageCount += session.messages.length
  }

  return {
    total: sessions.length,
    active: sessions.filter((item) => item.status !== 'completed').length,
    consensus: sessions.filter((item) => item.status === 'consensus').length,
    completed: sessions.filter((item) => item.status === 'completed').length,
    participants: participantIds.size,
    messages: messageCount,
  }
}

export function filterCollaborationSessions(
  sessions: CollaborationSession[],
  filter: CollaborationFilter,
  query = '',
): CollaborationSession[] {
  const normalized = query.trim().toLowerCase()

  return sessions.filter((session) => {
    if (filter.status && filter.status !== 'all' && session.status !== filter.status) return false
    if (filter.projectId && session.projectId !== filter.projectId) return false
    if (
      filter.employeeId &&
      !session.participants.some((item) => item.employeeId === filter.employeeId)
    ) {
      return false
    }

    if (!normalized) return true

    const haystack = [
      session.title,
      session.goal,
      ...session.participants.map((item) => item.codename),
      ...session.messages.map((item) => item.content),
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(normalized)
  })
}

export function getSessionsForProject(projectId: string): CollaborationSession[] {
  return loadCollaborationSessions().filter((item) => item.projectId === projectId)
}

export function getRecentCollaborationSessions(limit = 5): CollaborationSession[] {
  return loadCollaborationSessions().slice(0, limit)
}
