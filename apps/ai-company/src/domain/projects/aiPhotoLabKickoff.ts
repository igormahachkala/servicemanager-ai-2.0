import { loadApprovalStore } from '../approval/approvalStorage'
import type { Approval } from '../approval/approval'
import { getHandoffById } from '../handoff/handoffStorage'
import type { Handoff } from '../handoff/handoff'
import {
  AI_PHOTO_LAB_HANDOFF_002_ID,
  AI_PHOTO_LAB_HANDOFF_002_TITLE,
} from './aiPhotoLabCodexHandoff002'
import {
  buildAiPhotoLabControlRoom,
  type AiPhotoLabControlRoomSnapshot,
  type OwnerDecision,
} from './aiPhotoLabControlRoom'
import {
  AI_PHOTO_LAB_PROJECT_ID,
  AI_PHOTO_LAB_WORKSPACE_ID,
} from './aiPhotoLabIds'
import {
  KICKOFF_CTO_PLAN_EXCERPT,
  KICKOFF_DEMO_READINESS,
  KICKOFF_DOC_CTO_PLAN,
  KICKOFF_DOC_MAX_HANDOFF,
  KICKOFF_DOC_QA_CHECKLIST,
  KICKOFF_MAX_HANDOFF_EXCERPT,
  type KickoffDemoReadiness,
  type KickoffDocRef,
} from './aiPhotoLabKickoffDocs'
import { AI_PHOTO_LAB_SPRINT_1_ID, buildSprintSnapshot, getSprintById } from '../sprint/sprintStorage'
import type { SprintSnapshot } from '../sprint/sprintStorage'
import type { TaskRunnerMode } from '../taskRunner/taskRunnerTemplates'

export const AI_PHOTO_LAB_KICKOFF_PATH = `/ops/projects/${AI_PHOTO_LAB_PROJECT_ID}/kickoff`

export type KickoffTaskPreset = {
  id: 'atlas' | 'max' | 'qa'
  labelKey: 'startAtlas' | 'startMax' | 'startQa'
  employeeId: string
  employeeCodename: string
  mode: TaskRunnerMode
  title: string
  taskText: string
  expectedOutput: string
  constraints: string
  linkedTaskId: string
}

export type KickoffLinks = {
  runTask: string
  liveRuntime: string
  visualLab: string
  controlRoom: string
  sprint: string
  handoff: string
  execution: string
  timeline: string
  notifications: string
  commandCenter: string
  demoChecklistAnchor: string
}

export type AiPhotoLabKickoffSnapshot = {
  projectId: string
  workspaceId: string
  controlRoom: AiPhotoLabControlRoomSnapshot
  sprint: SprintSnapshot | null
  demoReadiness: KickoffDemoReadiness
  docs: {
    ctoPlan: KickoffDocRef
    maxHandoff: KickoffDocRef
    qaChecklist: KickoffDocRef
  }
  ctoPlan: typeof KICKOFF_CTO_PLAN_EXCERPT
  maxHandoff: typeof KICKOFF_MAX_HANDOFF_EXCERPT & { handoff: Handoff | null }
  ownerDecisions: OwnerDecision[]
  pendingApprovals: Approval[]
  taskPresets: KickoffTaskPreset[]
  links: KickoffLinks
}

const TASK_PRESETS: KickoffTaskPreset[] = [
  {
    id: 'atlas',
    labelKey: 'startAtlas',
    employeeId: 'ag-cto',
    employeeCodename: 'Atlas',
    mode: 'planning',
    title: 'Sprint 1 CTO planning kickoff',
    taskText: [
      'Kick off AI Photo Lab Sprint 1 as CTO.',
      'Review project context, Sprint 1 board, Control Room, and demo readiness.',
      'Finalize Codex backlog (task-apl-013) and week priorities for Owner approval.',
      'Output: updated CTO plan with risks, assignees, and Owner decision list.',
    ].join('\n'),
    expectedOutput: 'Sprint 1 CTO plan with Codex routing and Owner approval queue',
    constraints: 'Planning only — no Codex implementation until Owner approves backlog.',
    linkedTaskId: 'task-apl-013',
  },
  {
    id: 'max',
    labelKey: 'startMax',
    employeeId: 'ag-max',
    employeeCodename: 'MAX',
    mode: 'technical_audit',
    title: 'AI Photo Lab technical audit kickoff',
    taskText: [
      'Start Monday technical audit for AI Photo Lab MVP.',
      'Verify local startup (~/projects/ai-photo-lab), upload flow, and handoff package for Codex.',
      'Cross-check AI-PHOTO-LAB-002 findings against current vitrina behavior.',
      'Output: audit notes with fix list routed to Codex where code changes are required.',
    ].join('\n'),
    expectedOutput: 'Technical audit notes + Codex handoff readiness',
    constraints: 'Audit in AI Company — code changes only via Codex in ai-photo-lab repo.',
    linkedTaskId: 'task-apl-003',
  },
  {
    id: 'qa',
    labelKey: 'startQa',
    employeeId: 'ag-qa',
    employeeCodename: 'Sentinel',
    mode: 'qa_review',
    title: 'Demo readiness QA review kickoff',
    taskText: [
      'Run demo readiness review for AI Photo Lab MVP on vitrina.sma-assistants.ru.',
      'Use demo readiness checklist — 10 gates, conditional demo script.',
      'Flag Ollama vision instability on fresh upload; confirm workaround for Owner demo.',
      'Output: updated QA checklist status and sign-off recommendation for Owner.',
    ].join('\n'),
    expectedOutput: 'Demo readiness checklist with gate statuses and demo script notes',
    constraints: 'QA review only — no production deploy without Owner approval.',
    linkedTaskId: 'task-apl-010',
  },
]

function buildLinks(): KickoffLinks {
  const project = encodeURIComponent(AI_PHOTO_LAB_PROJECT_ID)
  const workspace = encodeURIComponent(AI_PHOTO_LAB_WORKSPACE_ID)
  const handoff = encodeURIComponent(AI_PHOTO_LAB_HANDOFF_002_ID)

  return {
    runTask: `/ops/run-task?project=${project}&workspace=${workspace}`,
    liveRuntime: '/ops/runtime/live',
    visualLab: '/ops/visual-lab',
    controlRoom: `/ops/projects/${project}/control-room`,
    sprint: '/ops/sprint/sprint-apl-1',
    handoff: `/ops/handoffs/${handoff}`,
    execution: `/ops/execution?project=${project}`,
    timeline: '/ops/timeline',
    notifications: '/ops/notifications',
    commandCenter: '/ops',
    demoChecklistAnchor: '#kickoff-qa-checklist',
  }
}

export function buildAiPhotoLabKickoffSnapshot(): AiPhotoLabKickoffSnapshot | null {
  const controlRoom = buildAiPhotoLabControlRoom()
  if (!controlRoom) return null

  const sprintRecord = getSprintById(AI_PHOTO_LAB_SPRINT_1_ID)
  const sprint = sprintRecord ? buildSprintSnapshot(sprintRecord) : null
  const handoff = getHandoffById(AI_PHOTO_LAB_HANDOFF_002_ID)

  const pendingApprovals = loadApprovalStore().approvals.filter(
    (item) =>
      item.status === 'pending' &&
      (item.workspaceId === AI_PHOTO_LAB_WORKSPACE_ID || item.actionType === 'production_deploy'),
  )

  return {
    projectId: AI_PHOTO_LAB_PROJECT_ID,
    workspaceId: AI_PHOTO_LAB_WORKSPACE_ID,
    controlRoom,
    sprint,
    demoReadiness: KICKOFF_DEMO_READINESS,
    docs: {
      ctoPlan: KICKOFF_DOC_CTO_PLAN,
      maxHandoff: KICKOFF_DOC_MAX_HANDOFF,
      qaChecklist: KICKOFF_DOC_QA_CHECKLIST,
    },
    ctoPlan: KICKOFF_CTO_PLAN_EXCERPT,
    maxHandoff: {
      ...KICKOFF_MAX_HANDOFF_EXCERPT,
      title: handoff?.title ?? AI_PHOTO_LAB_HANDOFF_002_TITLE,
      status: handoff?.status ?? KICKOFF_MAX_HANDOFF_EXCERPT.status,
      handoff,
    },
    ownerDecisions: controlRoom.ownerDecisions,
    pendingApprovals,
    taskPresets: TASK_PRESETS,
    links: buildLinks(),
  }
}
