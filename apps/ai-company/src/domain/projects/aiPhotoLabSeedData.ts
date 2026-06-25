import type { DeliveryTask, DeliveryTaskPriority, DeliveryTaskStatus } from '../tasks/task'
import {
  AI_PHOTO_LAB_PROJECT_ID,
  AI_PHOTO_LAB_WORKSPACE_ID,
} from './aiPhotoLabIds'

export {
  AI_PHOTO_LAB_ACTIVATION_KEY,
  AI_PHOTO_LAB_CHAT_ID,
  AI_PHOTO_LAB_PROJECT_ID,
  AI_PHOTO_LAB_WORKSPACE_ID,
} from './aiPhotoLabIds'

export function deadlineEndOfNextWeek(): string {
  const date = new Date()
  const day = date.getDay()
  const daysToNextFriday = ((5 - day + 7) % 7) + 7
  date.setDate(date.getDate() + daysToNextFriday)
  date.setHours(23, 59, 59, 0)
  return date.toISOString()
}

export function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600000).toISOString()
}

export function buildPhotoLabTaskSeeds(now: string): DeliveryTask[] {
  const base = {
    projectId: AI_PHOTO_LAB_PROJECT_ID,
    workspaceId: AI_PHOTO_LAB_WORKSPACE_ID,
    createdAt: now,
    updatedAt: now,
  }

  const specs: Array<{
    id: string
    title: string
    description: string
    assigneeId: string
    priority: DeliveryTaskPriority
    status: DeliveryTaskStatus
    expectedOutput: string
  }> = [
    {
      id: 'task-apl-001',
      title: 'MVP audit and stabilization plan',
      description: 'Cross-functional audit of AI Photo Lab MVP scope before deadline.',
      assigneeId: 'ag-ceo',
      priority: 'critical',
      status: 'in_progress',
      expectedOutput: 'Stabilization plan with owners, dates, and Codex handoff list',
    },
    {
      id: 'task-apl-002',
      title: 'Verify current production health',
      description: 'Check vitrina.sma-assistants.ru health endpoint and PM2 status (mock-only).',
      assigneeId: 'ag-devops',
      priority: 'high',
      status: 'in_progress',
      expectedOutput: 'Health verification report with uptime and HTTPS checks',
    },
    {
      id: 'task-apl-003',
      title: 'Verify local development startup',
      description: 'Confirm ~/projects/ai-photo-lab starts locally without blockers.',
      assigneeId: 'ag-max',
      priority: 'high',
      status: 'backlog',
      expectedOutput: 'Local startup checklist with resolved blockers',
    },
    {
      id: 'task-apl-004',
      title: 'Audit image upload flow',
      description: 'Trace upload UX from mobile and desktop through storage.',
      assigneeId: 'ag-max',
      priority: 'high',
      status: 'backlog',
      expectedOutput: 'Upload flow audit notes and fix list',
    },
    {
      id: 'task-apl-005',
      title: 'Audit AI analysis with qwen2.5vl:7b',
      description: 'Audit vision pipeline using qwen2.5vl:7b — latency, prompts, routing.',
      assigneeId: 'ag-arch',
      priority: 'high',
      status: 'in_progress',
      expectedOutput: 'Vision pipeline audit — latency, prompts, model routing',
    },
    {
      id: 'task-apl-006',
      title: 'Audit visual zone markup',
      description: 'Review automatic zone detection accuracy and UI feedback.',
      assigneeId: 'ag-arch',
      priority: 'medium',
      status: 'backlog',
      expectedOutput: 'Zone detection accuracy notes and UI gaps',
    },
    {
      id: 'task-apl-007',
      title: 'Audit manual zone editing',
      description: 'Validate manual correction workflow and persistence.',
      assigneeId: 'ag-max',
      priority: 'medium',
      status: 'backlog',
      expectedOutput: 'Manual editing UX audit and regression list',
    },
    {
      id: 'task-apl-008',
      title: 'Audit inspection chat',
      description: 'Review chat flow during inspection sessions.',
      assigneeId: 'ag-qa',
      priority: 'medium',
      status: 'backlog',
      expectedOutput: 'Chat flow audit with edge cases',
    },
    {
      id: 'task-apl-009',
      title: 'Audit PDF/report/history flow',
      description: 'Map report generation and history retention paths.',
      assigneeId: 'ag-qa',
      priority: 'high',
      status: 'backlog',
      expectedOutput: 'Report/history audit matrix',
    },
    {
      id: 'task-apl-010',
      title: 'Prepare QA checklist',
      description: 'Draft sign-off checklist for MVP demo.',
      assigneeId: 'ag-qa',
      priority: 'high',
      status: 'in_progress',
      expectedOutput: 'QA checklist draft for MVP sign-off',
    },
    {
      id: 'task-apl-011',
      title: 'Prepare deployment checklist',
      description: 'Document deploy steps for /opt/ai-photo-lab on production server.',
      assigneeId: 'ag-devops',
      priority: 'high',
      status: 'in_progress',
      expectedOutput: 'Deployment checklist for /opt/ai-photo-lab',
    },
    {
      id: 'task-apl-012',
      title: 'Prepare demo script',
      description: 'Owner-facing walkthrough for showcase inspection MVP.',
      assigneeId: 'ag-coo',
      priority: 'medium',
      status: 'backlog',
      expectedOutput: 'Owner demo script for showcase inspection MVP',
    },
    {
      id: 'task-apl-013',
      title: 'Identify Codex-only engineering tasks',
      description: 'Separate tasks that must be routed to Codex per owner directive.',
      assigneeId: 'ag-cto',
      priority: 'high',
      status: 'review',
      expectedOutput: 'Codex task backlog with complexity rationale',
    },
  ]

  return specs.map((item) => ({ ...base, ...item }))
}
