import { createAssignment, loadAssignments } from '../workspaces/assignment'
import { loadWorkspaces, saveWorkspaces, type Workspace } from '../workspaces/workspace'
import { createEmployeeParticipant, createOwnerParticipant } from '../chats/chatParticipant'
import type { Chat } from '../chats/chat'
import { saveNativeChats, loadNativeChats } from '../chats/chatStorage'
import { appendEvent, loadEvents } from '../events/eventStorage'
import type { CompanyEvent } from '../events/event'
import { ensurePhotoLabHandoffs } from '../handoff/handoffStorage'
import { loadKnowledgeStore, saveKnowledgeStore } from '../knowledge/knowledgeStorage'
import type { Knowledge } from '../knowledge/knowledge'
import { DEFAULT_COMPANY_ID } from './project'
import {
  createProjectTeamMember,
  createRoadmapItem,
  loadProjects,
  markProjectsSeeded,
  saveProjects,
  type Project,
} from './project'
import type { Milestone } from './milestone'
import type { ProjectRisk } from './risk'
import { saveReports, loadReports } from '../reports/reportStorage'
import type { Report } from '../reports/report'
import { saveRuntimeRuns, loadRuntimeRuns } from '../runtime/runtimeOrchestrator'
import type { RuntimeRun } from '../runtime/runtimeRun'
import type { RuntimePipelineStep } from '../runtime/runtimeState'
import { upsertDeliveryTasks } from '../tasks/taskStorage'
import {
  AI_PHOTO_LAB_ACTIVATION_KEY,
  AI_PHOTO_LAB_CHAT_ID,
  AI_PHOTO_LAB_PROJECT_ID,
  AI_PHOTO_LAB_WORKSPACE_ID,
  buildPhotoLabTaskSeeds,
  deadlineEndOfNextWeek,
  hoursAgo,
} from './aiPhotoLabSeedData'

const OWNER_ID = 'owner'

function isActivated(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(AI_PHOTO_LAB_ACTIVATION_KEY) === '1'
}

function markActivated(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(AI_PHOTO_LAB_ACTIVATION_KEY, '1')
  } catch {
    /* noop */
  }
}

function ensurePhotoLabWorkspace(): string {
  const workspaces = loadWorkspaces()
  const existing = workspaces.find((item) => item.id === AI_PHOTO_LAB_WORKSPACE_ID)
  if (existing) {
    const next = workspaces.map((item) =>
      item.id === AI_PHOTO_LAB_WORKSPACE_ID
        ? {
            ...item,
            name: 'AI Photo Lab / ИИ Контроль витрин',
            description:
              'Internal MVP — AI-powered showcase inspection, visual zones, chat, training examples, production at vitrina.sma-assistants.ru',
            status: 'active' as const,
            companyId: item.companyId ?? DEFAULT_COMPANY_ID,
          }
        : item,
    )
    saveWorkspaces(next)
    return AI_PHOTO_LAB_WORKSPACE_ID
  }

  const createdAt = new Date().toISOString()
  const workspace: Workspace = {
    id: AI_PHOTO_LAB_WORKSPACE_ID,
    companyId: DEFAULT_COMPANY_ID,
    name: 'AI Photo Lab / ИИ Контроль витрин',
    description:
      'Internal MVP — AI-powered showcase inspection, visual zones, chat, training examples, production at vitrina.sma-assistants.ru',
    type: 'product',
    status: 'active',
    owner: 'Igor',
    createdAt,
    updatedAt: createdAt,
  }
  saveWorkspaces([...workspaces, workspace])
  return AI_PHOTO_LAB_WORKSPACE_ID
}

function buildPhotoLabProject(workspaceId: string, now: string, deadline: string): Project {
  return {
    id: AI_PHOTO_LAB_PROJECT_ID,
    companyId: DEFAULT_COMPANY_ID,
    workspaceId,
    title: 'AI Photo Lab / ИИ Контроль витрин',
    description:
      'Type: internal MVP · Goal: working MVP for showcase inspection.\n\nFirst internal product delivered through AI Company Project Delivery Engine. Digital workforce manages audit, QA, deployment checklists, and Codex handoff — without modifying the standalone ai-photo-lab repo in this task.',
    status: 'active',
    priority: 'high',
    deadline,
    owner: 'Igor',
    team: [
      createProjectTeamMember({ employeeId: 'ag-ceo', role: 'pm', label: 'Apex — AI CEO' }),
      createProjectTeamMember({ employeeId: 'ag-cto', role: 'lead', label: 'Atlas — AI CTO' }),
      createProjectTeamMember({ employeeId: 'ag-arch', role: 'architect', label: 'Daedalus — AI Architect' }),
      createProjectTeamMember({ employeeId: 'ag-max', role: 'developer', label: 'MAX — Senior Developer' }),
      createProjectTeamMember({ employeeId: 'ag-qa', role: 'qa', label: 'Sentinel — AI QA' }),
      createProjectTeamMember({ employeeId: 'ag-devops', role: 'member', label: 'Helm — AI DevOps' }),
      createProjectTeamMember({ employeeId: 'ag-coo', role: 'pm', label: 'Ops — AI Product Analyst' }),
      createProjectTeamMember({ employeeId: 'ag-asst', role: 'designer', label: 'Nova — AI Designer' }),
    ],
    progress: 28,
    milestones: [
      {
        id: 'ms-apl-activation',
        title: 'Project activation in AI Company',
        description: 'Team, tasks, knowledge, chat, runtime runs, and reports seeded.',
        status: 'done',
        progress: 100,
        dueDate: now,
      },
      {
        id: 'ms-apl-audit',
        title: 'MVP audit & stabilization',
        description: 'Production health, feature audits, QA and deployment checklists.',
        status: 'in_progress',
        progress: 35,
        dueDate: deadline,
      },
      {
        id: 'ms-apl-demo',
        title: 'Showcase inspection MVP demo',
        description: 'Owner demo on vitrina.sma-assistants.ru with signed QA gate.',
        status: 'planned',
        progress: 0,
        dueDate: deadline,
      },
    ] satisfies Milestone[],
    roadmap: [
      createRoadmapItem({
        title: 'Delivery through AI Company',
        description: 'Manage AI Photo Lab as first active internal project.',
        horizon: 'now',
        quarter: 'Q2 2026',
      }),
      createRoadmapItem({
        title: 'Codex engineering handoff',
        description: 'Complex code tasks routed to Codex per owner directive.',
        horizon: 'now',
        quarter: 'Q2 2026',
      }),
      createRoadmapItem({
        title: 'ServiceManager integration',
        description: 'Future — out of scope for this MVP.',
        horizon: 'later',
        quarter: 'Q3 2026',
      }),
    ],
    risks: [
      {
        id: 'risk-apl-vision-latency',
        title: 'qwen2.5vl:7b latency on mobile',
        description: 'Vision analysis may exceed acceptable SLA on slow networks.',
        severity: 'medium',
        status: 'open',
        mitigation: 'Resize images client-side; async analysis jobs.',
      },
      {
        id: 'risk-apl-deadline',
        title: 'End-of-week MVP deadline',
        description: '13 audit tasks must complete before demo.',
        severity: 'high',
        status: 'open',
        mitigation: 'Parallel audits; Codex for code-heavy fixes.',
      },
      {
        id: 'risk-apl-scope',
        title: 'Scope creep into ServiceManager',
        description: 'AI Photo Lab must stay isolated from SMA core.',
        severity: 'high',
        status: 'mitigated',
        mitigation: 'Separate repo ~/projects/ai-photo-lab — no SMA coupling.',
      },
    ] satisfies ProjectRisk[],
    createdAt: now,
    updatedAt: now,
  }
}

function upsertPhotoLabProject(): Project {
  const workspaceId = ensurePhotoLabWorkspace()
  const now = new Date().toISOString()
  const deadline = deadlineEndOfNextWeek()
  const project = buildPhotoLabProject(workspaceId, now, deadline)
  const projects = loadProjects()
  const index = projects.findIndex((item) => item.id === AI_PHOTO_LAB_PROJECT_ID)
  if (index >= 0) {
    const merged = { ...projects[index], ...project, createdAt: projects[index].createdAt }
    const next = [...projects]
    next[index] = merged
    saveProjects(next)
    return merged
  }
  saveProjects([...projects, project])
  return project
}

function ensurePhotoLabAssignments(workspaceId: string): void {
  const specs = [
    { employeeId: 'ag-cto', role: 'Technical Lead', loadPercent: 25 },
    { employeeId: 'ag-max', role: 'Lead Developer', loadPercent: 45 },
    { employeeId: 'ag-arch', role: 'Architect', loadPercent: 20 },
    { employeeId: 'ag-qa', role: 'QA Lead', loadPercent: 30 },
    { employeeId: 'ag-devops', role: 'DevOps', loadPercent: 20 },
    { employeeId: 'ag-ceo', role: 'Executive Sponsor', loadPercent: 10 },
    { employeeId: 'ag-coo', role: 'Product Analyst', loadPercent: 15 },
    { employeeId: 'ag-asst', role: 'Designer', loadPercent: 10 },
  ]
  const assignments = loadAssignments()
  for (const spec of specs) {
    if (assignments.some((item) => item.workspaceId === workspaceId && item.employeeId === spec.employeeId)) {
      continue
    }
    createAssignment({ ...spec, workspaceId })
  }
}

function seedPhotoLabTasks(now: string): void {
  upsertDeliveryTasks(buildPhotoLabTaskSeeds(now))
}

function seedPhotoLabKnowledge(workspaceId: string, now: string): void {
  const items: Knowledge[] = [
    {
      id: 'kn-apl-overview',
      title: 'AI Photo Lab — Product Overview',
      summary: 'Internal MVP for AI-powered showcase inspection and display control.',
      content:
        'AI Photo Lab (ИИ Контроль витрин) is the first internal product managed through AI Company.\n\nGoal: working MVP for showcase inspection by end of next week.\n\nOwner directs delivery via AI Company; complex code tasks go to Codex.',
      type: 'documentation',
      source: 'markdown',
      tags: ['ai-photo-lab', 'mvp', 'delivery'],
      workspaceId,
      ownerEmployeeId: 'ag-ceo',
      status: 'published',
      createdAt: hoursAgo(6),
      updatedAt: now,
    },
    {
      id: 'kn-apl-paths',
      title: 'AI Photo Lab — Paths & Infrastructure',
      summary: 'Local path, production server, deploy path, site, and health check.',
      content:
        'Local project path:\n~/projects/ai-photo-lab\n\nProduction server:\n194.67.92.12\n\nProduction path:\n/opt/ai-photo-lab\n\nSite:\nhttps://vitrina.sma-assistants.ru\n\nHealth:\nhttps://vitrina.sma-assistants.ru/health\n\nRuntime: PM2, HTTPS production domain.',
      type: 'documentation',
      source: 'markdown',
      tags: ['ai-photo-lab', 'infra', 'devops'],
      workspaceId,
      ownerEmployeeId: 'ag-devops',
      status: 'published',
      createdAt: hoursAgo(5),
      updatedAt: now,
    },
    {
      id: 'kn-apl-model',
      title: 'AI Photo Lab — Vision Model',
      summary: 'Ollama qwen2.5vl:7b for AI analysis pipeline.',
      content:
        'Ollama model:\nqwen2.5vl:7b\n\nUsed for AI analysis, visual zone detection, and inspection chat context.\n\nNo live Ollama calls from AI Company — verification tasks are mock-only in V1.',
      type: 'documentation',
      source: 'markdown',
      tags: ['ai-photo-lab', 'ollama', 'vision'],
      workspaceId,
      ownerEmployeeId: 'ag-arch',
      status: 'published',
      createdAt: hoursAgo(4),
      updatedAt: now,
    },
    {
      id: 'kn-apl-features',
      title: 'AI Photo Lab — Implemented Features',
      summary: 'Current MVP feature set already built in standalone repo.',
      content:
        'Current implemented features:\n- AI analysis\n- Visual zones\n- Chat\n- Training examples\n- Manual zone editing\n- Mobile navigation\n- Onboarding\n- Zoom/pan\n- Settings accordion\n- HTTPS\n- PM2\n- Production domain vitrina.sma-assistants.ru',
      type: 'documentation',
      source: 'markdown',
      tags: ['ai-photo-lab', 'features', 'mvp'],
      workspaceId,
      ownerEmployeeId: 'ag-max',
      status: 'published',
      createdAt: hoursAgo(3),
      updatedAt: now,
    },
    {
      id: 'kn-apl-delivery',
      title: 'AI Photo Lab — Delivery Process',
      summary: 'How digital workforce manages delivery through AI Company.',
      content:
        'Delivery channels:\n- Project tasks (13 audit/checklist items)\n- #ai-photo-lab-delivery chat\n- Runtime runs for architecture, audit, QA, DevOps\n- Draft reports: readiness, risk, delivery plan\n- Timeline events for activation\n\nCodex handles complex code changes only.',
      type: 'runbook',
      source: 'markdown',
      tags: ['ai-photo-lab', 'delivery', 'process'],
      workspaceId,
      ownerEmployeeId: 'ag-cto',
      status: 'published',
      createdAt: hoursAgo(2),
      updatedAt: now,
    },
  ]

  const store = loadKnowledgeStore()
  const merged = [...store.items]
  for (const item of items) {
    const index = merged.findIndex((entry) => entry.id === item.id)
    if (index >= 0) merged[index] = item
    else merged.push(item)
  }
  saveKnowledgeStore({ ...store, items: merged })
}

function seedPhotoLabChat(workspaceId: string, now: string): void {
  const ownerMessage =
    'Нужно довести AI Photo Lab / ИИ Контроль витрин до рабочего MVP к концу следующей недели. Цифровая команда должна управлять разработкой через AI Company. Сложные кодовые задачи отдавать Codex.'

  const participants = [
    createOwnerParticipant(now, 'Owner'),
    createEmployeeParticipant('ag-ceo', 'Apex', 'AI CEO', now),
    createEmployeeParticipant('ag-cto', 'Atlas', 'AI CTO', now),
    createEmployeeParticipant('ag-arch', 'Daedalus', 'AI Architect', now),
    createEmployeeParticipant('ag-max', 'MAX', 'Senior Developer', now),
    createEmployeeParticipant('ag-qa', 'Sentinel', 'AI QA', now),
    createEmployeeParticipant('ag-devops', 'Helm', 'AI DevOps', now),
    createEmployeeParticipant('ag-coo', 'Ops', 'AI Product Analyst', now),
    createEmployeeParticipant('ag-asst', 'Nova', 'AI Designer', now),
  ]

  const chat: Chat = {
    id: AI_PHOTO_LAB_CHAT_ID,
    title: '#ai-photo-lab-delivery',
    type: 'group',
    workspaceId,
    participants,
    messages: [
      {
        id: 'chatmsg-apl-kickoff',
        chatId: AI_PHOTO_LAB_CHAT_ID,
        authorId: OWNER_ID,
        authorType: 'owner',
        content: ownerMessage,
        type: 'message',
        status: 'sent',
        createdAt: hoursAgo(2),
      },
      {
        id: 'chatmsg-apl-atlas-reply',
        chatId: AI_PHOTO_LAB_CHAT_ID,
        authorId: 'ag-cto',
        authorType: 'employee',
        content:
          'Принято. Запускаю architecture review runtime и формирую Codex-only backlog. Atlas.',
        type: 'message',
        status: 'sent',
        createdAt: hoursAgo(1),
      },
    ],
    status: 'active',
    createdAt: hoursAgo(2),
    updatedAt: now,
  }

  const chats = loadNativeChats()
  const index = chats.findIndex((item) => item.id === AI_PHOTO_LAB_CHAT_ID)
  if (index >= 0) {
    const next = [...chats]
    next[index] = chat
    saveNativeChats(next)
  } else {
    saveNativeChats([chat, ...chats])
  }
}

function buildCompletedPipeline(): RuntimePipelineStep[] {
  return [
    { id: 'receive_request', order: 1, status: 'done', detail: 'Request accepted' },
    { id: 'load_employee', order: 2, status: 'done' },
    { id: 'load_workspace', order: 3, status: 'done' },
    { id: 'load_memory', order: 4, status: 'done' },
    { id: 'load_knowledge', order: 5, status: 'done' },
    { id: 'load_competencies', order: 6, status: 'done' },
    { id: 'load_runtime_profile', order: 7, status: 'done' },
    { id: 'run_model_router', order: 8, status: 'done' },
    { id: 'approval_check', order: 9, status: 'skipped' },
    { id: 'create_run', order: 10, status: 'done' },
    { id: 'emit_event', order: 11, status: 'done' },
    { id: 'create_report', order: 12, status: 'done' },
    { id: 'complete', order: 13, status: 'done' },
  ]
}

function buildMockRuntimeRun(input: {
  id: string
  employeeId: string
  workspaceId: string
  taskId: string
  title: string
  reportId: string | null
  startedAt: string
  finishedAt: string | null
  status: RuntimeRun['status']
}): RuntimeRun {
  return {
    id: input.id,
    employeeId: input.employeeId,
    workspaceId: input.workspaceId,
    runtimeProfileId: `profile-${input.employeeId}`,
    modelId: 'qwen2.5vl:7b',
    providerId: 'ollama',
    taskId: input.taskId,
    chatId: AI_PHOTO_LAB_CHAT_ID,
    reportId: input.reportId,
    status: input.status,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    context: {
      employeeId: input.employeeId,
      workspaceId: input.workspaceId,
      taskId: input.taskId,
      chatId: AI_PHOTO_LAB_CHAT_ID,
      layers: [
        {
          key: 'employee_profile',
          loaded: true,
          itemCount: 1,
          summary: input.title,
        },
        {
          key: 'knowledge',
          loaded: true,
          itemCount: 5,
          summary: 'AI Photo Lab knowledge pack loaded',
        },
        {
          key: 'workspace',
          loaded: true,
          itemCount: 1,
          summary: 'AI Photo Lab workspace',
        },
      ],
      builtAt: input.startedAt,
    },
    pipeline: buildCompletedPipeline(),
    result: {
      selectedModel: 'qwen2.5vl:7b',
      selectedProvider: 'ollama',
      contextSize: 5,
      knowledgeUsed: 5,
      memoryUsed: 2,
      estimatedCost: 0,
      estimatedTokens: 0,
      warnings: [],
      artifacts: input.reportId
        ? [{ id: `art-${input.id}`, kind: 'report', label: 'Draft report', refId: input.reportId }]
        : [],
    },
  }
}

function seedPhotoLabRuntimeRuns(workspaceId: string): void {
  const runs: RuntimeRun[] = [
    buildMockRuntimeRun({
      id: 'run-apl-atlas-arch-review',
      employeeId: 'ag-cto',
      workspaceId,
      taskId: 'task-apl-013',
      title: 'Atlas architecture review',
      reportId: 'report-apl-delivery-plan',
      startedAt: hoursAgo(4),
      finishedAt: hoursAgo(3),
      status: 'completed',
    }),
    buildMockRuntimeRun({
      id: 'run-apl-max-code-audit',
      employeeId: 'ag-max',
      workspaceId,
      taskId: 'task-apl-004',
      title: 'MAX code audit preparation',
      reportId: null,
      startedAt: hoursAgo(3),
      finishedAt: null,
      status: 'running',
    }),
    buildMockRuntimeRun({
      id: 'run-apl-qa-checklist',
      employeeId: 'ag-qa',
      workspaceId,
      taskId: 'task-apl-010',
      title: 'QA checklist generation',
      reportId: 'report-apl-readiness',
      startedAt: hoursAgo(2),
      finishedAt: hoursAgo(1),
      status: 'completed',
    }),
    buildMockRuntimeRun({
      id: 'run-apl-devops-deploy-checklist',
      employeeId: 'ag-devops',
      workspaceId,
      taskId: 'task-apl-011',
      title: 'DevOps deployment checklist',
      reportId: 'report-apl-risk',
      startedAt: hoursAgo(2),
      finishedAt: hoursAgo(1),
      status: 'completed',
    }),
  ]

  const current = loadRuntimeRuns()
  const next = [...current]
  for (const run of runs) {
    const index = next.findIndex((item) => item.id === run.id)
    if (index >= 0) next[index] = run
    else next.unshift(run)
  }
  saveRuntimeRuns(next)
}

function seedPhotoLabReports(workspaceId: string, now: string): void {
  const reports: Report[] = [
    {
      id: 'report-apl-readiness',
      companyId: DEFAULT_COMPANY_ID,
      title: 'AI Photo Lab MVP Readiness Report',
      type: 'qa',
      employeeId: 'ag-qa',
      workspaceId,
      summary:
        'Draft readiness assessment for showcase inspection MVP — features implemented, audits in progress.',
      findings: [
        'Core features deployed: AI analysis, zones, chat, training, manual editing, mobile nav.',
        'Production health endpoint available at /health.',
        '13 delivery tasks tracked in AI Company.',
      ],
      risks: ['PDF/report flow not fully audited yet.', 'Vision latency unverified on mobile networks.'],
      recommendations: [
        'Complete tasks task-apl-008 through task-apl-009 before demo.',
        'Run full QA checklist sign-off.',
      ],
      evidence: [
        {
          id: 'ev-apl-site',
          label: 'Production site',
          kind: 'link',
          value: 'https://vitrina.sma-assistants.ru',
        },
        {
          id: 'ev-apl-health',
          label: 'Health check',
          kind: 'link',
          value: 'https://vitrina.sma-assistants.ru/health',
        },
      ],
      status: 'draft',
      createdAt: hoursAgo(2),
      updatedAt: now,
    },
    {
      id: 'report-apl-risk',
      companyId: DEFAULT_COMPANY_ID,
      title: 'AI Photo Lab Risk Report',
      type: 'operations',
      employeeId: 'ag-devops',
      workspaceId,
      summary: 'Operational risks for MVP deadline and production stability.',
      findings: [
        'PM2 and HTTPS configured on production domain.',
        'Deploy path /opt/ai-photo-lab on 194.67.92.12.',
      ],
      risks: [
        'End-of-week deadline with parallel audit workload.',
        'qwen2.5vl:7b analysis latency on slow connections.',
        'Codex handoff backlog not fully sized.',
      ],
      recommendations: [
        'Prioritize production health verification daily.',
        'Keep ServiceManager integration out of scope.',
      ],
      evidence: [
        {
          id: 'ev-apl-server',
          label: 'Production server',
          kind: 'metric',
          value: '194.67.92.12',
        },
      ],
      status: 'draft',
      createdAt: hoursAgo(2),
      updatedAt: now,
    },
    {
      id: 'report-apl-delivery-plan',
      companyId: DEFAULT_COMPANY_ID,
      title: 'AI Photo Lab Delivery Plan',
      type: 'architecture',
      employeeId: 'ag-cto',
      workspaceId,
      summary: 'Atlas delivery plan — audits, Codex routing, demo path.',
      findings: [
        'Digital team assigned across 8 roles.',
        'Delivery chat #ai-photo-lab-delivery active.',
      ],
      risks: ['Scope creep if audits expand beyond MVP.'],
      recommendations: [
        'Route complex code to Codex per owner directive.',
        'Demo script owned by Product Analyst (task-apl-012).',
      ],
      evidence: [
        {
          id: 'ev-apl-local',
          label: 'Local path',
          kind: 'quote',
          value: '~/projects/ai-photo-lab',
        },
      ],
      status: 'draft',
      createdAt: hoursAgo(3),
      updatedAt: now,
    },
  ]

  const current = loadReports()
  const next = [...current]
  for (const report of reports) {
    const index = next.findIndex((item) => item.id === report.id)
    if (index >= 0) next[index] = report
    else next.unshift(report)
  }
  saveReports(next)
}

function seedPhotoLabEvents(workspaceId: string, now: string): void {
  const existing = loadEvents()
  const seeds: CompanyEvent[] = [
    {
      id: 'evt-apl-activation',
      type: 'task.created',
      sourceType: 'workspace',
      sourceId: AI_PHOTO_LAB_PROJECT_ID,
      employeeId: 'ag-ceo',
      workspaceId,
      reportId: null,
      metadata: {
        title: 'AI Photo Lab project activated',
        message: 'AI Photo Lab / ИИ Контроль витрин is now the first active internal delivery project.',
        projectId: AI_PHOTO_LAB_PROJECT_ID,
      },
      severity: 'success',
      createdAt: hoursAgo(6),
    },
    {
      id: 'evt-apl-knowledge',
      type: 'knowledge.updated',
      sourceType: 'knowledge',
      sourceId: 'kn-apl-overview',
      employeeId: 'ag-cto',
      workspaceId,
      reportId: null,
      metadata: { title: 'AI Photo Lab knowledge pack published', count: 5 },
      severity: 'info',
      createdAt: hoursAgo(5),
    },
    {
      id: 'evt-apl-chat',
      type: 'chat.message',
      sourceType: 'chat',
      sourceId: AI_PHOTO_LAB_CHAT_ID,
      employeeId: null,
      workspaceId,
      reportId: null,
      metadata: {
        preview: 'Owner kickoff — MVP к концу следующей недели',
        channel: '#ai-photo-lab-delivery',
      },
      severity: 'info',
      createdAt: hoursAgo(2),
    },
    {
      id: 'evt-apl-runtime-atlas',
      type: 'runtime.started',
      sourceType: 'runtime',
      sourceId: 'run-apl-atlas-arch-review',
      employeeId: 'ag-cto',
      workspaceId,
      reportId: 'report-apl-delivery-plan',
      metadata: { title: 'Atlas started architecture review runtime' },
      severity: 'info',
      createdAt: hoursAgo(4),
    },
    {
      id: 'evt-apl-runtime-max',
      type: 'runtime.started',
      sourceType: 'runtime',
      sourceId: 'run-apl-max-code-audit',
      employeeId: 'ag-max',
      workspaceId,
      reportId: null,
      metadata: { title: 'MAX started code audit preparation' },
      severity: 'info',
      createdAt: hoursAgo(3),
    },
    {
      id: 'evt-apl-report-readiness',
      type: 'report.created',
      sourceType: 'report',
      sourceId: 'report-apl-readiness',
      employeeId: 'ag-qa',
      workspaceId,
      reportId: 'report-apl-readiness',
      metadata: { title: 'AI Photo Lab MVP Readiness Report (draft)' },
      severity: 'success',
      createdAt: hoursAgo(2),
    },
  ]

  for (const event of seeds) {
    if (existing.some((item) => item.id === event.id)) continue
    appendEvent(event)
  }

  if (!existing.some((item) => item.id === 'evt-apl-activation')) {
    appendEvent({
      id: 'evt-apl-tasks-batch',
      type: 'task.created',
      sourceType: 'workspace',
      sourceId: workspaceId,
      employeeId: 'ag-cto',
      workspaceId,
      reportId: null,
      metadata: { title: '13 delivery tasks created for AI Photo Lab', count: 13 },
      severity: 'info',
      createdAt: now,
    })
  }
}

/** Idempotent activation of AI Photo Lab as the first managed internal project. */
export function ensureAiPhotoLabActivation(): Project {
  const now = new Date().toISOString()
  const project = upsertPhotoLabProject()
  ensurePhotoLabAssignments(project.workspaceId)
  seedPhotoLabTasks(now)
  seedPhotoLabKnowledge(project.workspaceId, now)
  seedPhotoLabChat(project.workspaceId, now)
  seedPhotoLabRuntimeRuns(project.workspaceId)
  seedPhotoLabReports(project.workspaceId, now)
  ensurePhotoLabHandoffs()

  if (!isActivated()) {
    seedPhotoLabEvents(project.workspaceId, now)
    markActivated()
  } else {
    seedPhotoLabEvents(project.workspaceId, now)
  }

  markProjectsSeeded()
  return project
}

export function ensureSeedProjects(): import('./project').Project[] {
  ensureAiPhotoLabActivation()
  return loadProjects()
}

export { AI_PHOTO_LAB_PROJECT_ID, AI_PHOTO_LAB_WORKSPACE_ID, AI_PHOTO_LAB_CHAT_ID } from './aiPhotoLabIds'
