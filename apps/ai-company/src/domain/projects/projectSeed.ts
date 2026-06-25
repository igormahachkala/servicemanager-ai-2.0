import { createAssignment, loadAssignments } from '../workspaces/assignment'
import { createWorkspace, loadWorkspaces } from '../workspaces/workspace'
import {
  createMilestone,
  createProjectRisk,
  createProjectTeamMember,
  createRoadmapItem,
  DEFAULT_COMPANY_ID,
  isProjectsSeeded,
  loadProjects,
  markProjectsSeeded,
  saveProjects,
  type Project,
} from './project'

const AI_PHOTO_LAB_WORKSPACE_ID = 'workspace-ai-photo-lab'
const AI_PHOTO_LAB_PROJECT_ID = 'project-ai-photo-lab'

export function ensureSeedProjects(): Project[] {
  if (isProjectsSeeded()) {
    return loadProjects()
  }

  const existing = loadProjects()
  if (existing.some((item) => item.id === AI_PHOTO_LAB_PROJECT_ID)) {
    markProjectsSeeded()
    return existing
  }

  let workspaceId = AI_PHOTO_LAB_WORKSPACE_ID
  const workspaces = loadWorkspaces()
  const existingWorkspace = workspaces.find((item) => item.id === AI_PHOTO_LAB_WORKSPACE_ID)

  if (!existingWorkspace) {
    const workspace = createWorkspace({
      name: 'AI Photo Lab',
      description: 'Operational workspace for the AI Photo Lab internal product — vision QA, display control, photo pipelines.',
      companyId: DEFAULT_COMPANY_ID,
      type: 'product',
      status: 'active',
      owner: 'Igor',
    })
    workspaceId = workspace.id
  }

  const now = new Date()
  const deadline = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()

  const project: Project = {
    id: AI_PHOTO_LAB_PROJECT_ID,
    companyId: DEFAULT_COMPANY_ID,
    workspaceId,
    title: 'AI Photo Lab',
    description:
      'Internal product for AI-powered photo analysis — first delivery target for the Project Delivery Engine. Includes display control MVP and future photo QA pipelines.',
    status: 'active',
    priority: 'high',
    deadline,
    owner: 'Igor',
    team: [
      createProjectTeamMember({ employeeId: 'ag-cto', role: 'lead', label: 'Atlas — AI CTO' }),
      createProjectTeamMember({ employeeId: 'ag-max', role: 'developer', label: 'MAX — Senior Developer' }),
      createProjectTeamMember({ employeeId: 'ag-arch', role: 'architect', label: 'Daedalus — Architect' }),
    ],
    progress: 35,
    milestones: [
      createMilestone({
        title: 'Project Delivery Engine V1',
        description: 'Project entity, pages, dashboard widgets, seed project.',
        status: 'in_progress',
        progress: 60,
        dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      }),
      createMilestone({
        title: 'Display Control MVP docs',
        description: 'MVP scope, architecture, user flow, checklist for vitrina control.',
        status: 'done',
        progress: 100,
        dueDate: now.toISOString(),
      }),
      createMilestone({
        title: 'Display Control implementation',
        description: 'Standalone app: photo → AI → violations → PDF.',
        status: 'planned',
        progress: 0,
        dueDate: deadline,
      }),
    ],
    roadmap: [
      createRoadmapItem({
        title: 'Project pages & team board',
        description: 'Full project delivery UI in AI Company.',
        horizon: 'now',
        quarter: 'Q2 2026',
      }),
      createRoadmapItem({
        title: 'Display Control standalone app',
        description: 'First product built through the delivery engine.',
        horizon: 'now',
        quarter: 'Q2 2026',
      }),
      createRoadmapItem({
        title: 'Budget & release tracking',
        description: 'Client, invoices, releases placeholders → live modules.',
        horizon: 'later',
        quarter: 'Q3 2026',
      }),
    ],
    risks: [
      createProjectRisk({
        title: 'Vision model latency',
        description: 'Photo analysis may exceed 60s SLA on mobile networks.',
        severity: 'medium',
        status: 'open',
        mitigation: 'Async jobs, client-side resize, retry policy.',
      }),
      createProjectRisk({
        title: 'Scope creep into ServiceManager',
        description: 'Display control must stay isolated from SMA core.',
        severity: 'high',
        status: 'mitigated',
        mitigation: 'Separate repo path apps/display-control, documented in architecture.',
      }),
    ],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }

  saveProjects([...loadProjects(), project])

  const assignments = loadAssignments()
  if (!assignments.some((item) => item.workspaceId === workspaceId && item.employeeId === 'ag-max')) {
    createAssignment({
      employeeId: 'ag-max',
      workspaceId,
      role: 'Lead Developer',
      loadPercent: 40,
    })
  }
  if (!assignments.some((item) => item.workspaceId === workspaceId && item.employeeId === 'ag-cto')) {
    createAssignment({
      employeeId: 'ag-cto',
      workspaceId,
      role: 'Technical Lead',
      loadPercent: 20,
    })
  }

  markProjectsSeeded()
  return loadProjects()
}

export { AI_PHOTO_LAB_PROJECT_ID, AI_PHOTO_LAB_WORKSPACE_ID }
