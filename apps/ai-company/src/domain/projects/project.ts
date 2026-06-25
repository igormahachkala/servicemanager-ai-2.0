import { createMilestone, parseMilestone, type Milestone } from './milestone'
import { createProjectRisk, parseProjectRisk, type ProjectRisk } from './risk'
import { createProjectTeamMember, parseProjectTeamMember, type ProjectTeamMember } from './projectTeam'
import { createRoadmapItem, parseRoadmapItem, type RoadmapItem } from './roadmap'

export const DEFAULT_COMPANY_ID = 'company-ai-company'

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'archived'
export type ProjectPriority = 'low' | 'medium' | 'high' | 'critical'

export type Project = {
  id: string
  companyId: string
  workspaceId: string
  title: string
  description: string
  status: ProjectStatus
  priority: ProjectPriority
  deadline: string | null
  owner: string
  team: ProjectTeamMember[]
  progress: number
  milestones: Milestone[]
  roadmap: RoadmapItem[]
  risks: ProjectRisk[]
  createdAt: string
  updatedAt: string
}

export type CreateProjectInput = {
  companyId?: string
  workspaceId: string
  title: string
  description?: string
  status?: ProjectStatus
  priority?: ProjectPriority
  deadline?: string | null
  owner?: string
  team?: ProjectTeamMember[]
  progress?: number
  milestones?: Milestone[]
  roadmap?: RoadmapItem[]
  risks?: ProjectRisk[]
}

const STORAGE_KEY = 'ai-company-projects'
const SEED_FLAG_KEY = 'ai-company-projects-seeded'

const PROJECT_STATUSES: ProjectStatus[] = ['planning', 'active', 'on_hold', 'completed', 'archived']
const PROJECT_PRIORITIES: ProjectPriority[] = ['low', 'medium', 'high', 'critical']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

function parseProjectStatus(value: unknown): ProjectStatus {
  if (typeof value === 'string' && PROJECT_STATUSES.includes(value as ProjectStatus)) {
    return value as ProjectStatus
  }
  return 'planning'
}

function parseProjectPriority(value: unknown): ProjectPriority {
  if (typeof value === 'string' && PROJECT_PRIORITIES.includes(value as ProjectPriority)) {
    return value as ProjectPriority
  }
  return 'medium'
}

export function parseProject(value: unknown): Project | null {
  if (!isRecord(value)) return null

  if (
    typeof value.id !== 'string' ||
    typeof value.companyId !== 'string' ||
    typeof value.workspaceId !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }

  const milestones = Array.isArray(value.milestones)
    ? value.milestones.map(parseMilestone).filter((item): item is Milestone => item !== null)
    : []

  const roadmap = Array.isArray(value.roadmap)
    ? value.roadmap.map(parseRoadmapItem).filter((item): item is RoadmapItem => item !== null)
    : []

  const risks = Array.isArray(value.risks)
    ? value.risks.map(parseProjectRisk).filter((item): item is ProjectRisk => item !== null)
    : []

  const team = Array.isArray(value.team)
    ? value.team.map(parseProjectTeamMember).filter((item): item is ProjectTeamMember => item !== null)
    : []

  return {
    id: value.id,
    companyId: value.companyId,
    workspaceId: value.workspaceId,
    title: value.title,
    description: typeof value.description === 'string' ? value.description : '',
    status: parseProjectStatus(value.status),
    priority: parseProjectPriority(value.priority),
    deadline: typeof value.deadline === 'string' ? value.deadline : null,
    owner: typeof value.owner === 'string' ? value.owner : '',
    team,
    progress: clampProgress(typeof value.progress === 'number' ? value.progress : 0),
    milestones,
    roadmap,
    risks,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

export function loadProjects(): Project[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseProject).filter((item): item is Project => item !== null)
  } catch {
    return []
  }
}

export function saveProjects(projects: Project[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
  } catch {
    /* noop */
  }
}

export function getProjectById(id: string): Project | null {
  return loadProjects().find((project) => project.id === id) ?? null
}

export function getProjectsByWorkspaceId(workspaceId: string): Project[] {
  return loadProjects().filter((project) => project.workspaceId === workspaceId)
}

export function getProjectsByCompanyId(companyId: string): Project[] {
  return loadProjects().filter((project) => project.companyId === companyId)
}

export function createProject(input: CreateProjectInput): Project {
  const now = new Date().toISOString()
  const project: Project = {
    id: `project-${Date.now()}`,
    companyId: input.companyId ?? DEFAULT_COMPANY_ID,
    workspaceId: input.workspaceId,
    title: input.title.trim(),
    description: (input.description ?? '').trim(),
    status: input.status ?? 'planning',
    priority: input.priority ?? 'medium',
    deadline: input.deadline ?? null,
    owner: (input.owner ?? '').trim(),
    team: input.team ?? [],
    progress: clampProgress(input.progress ?? 0),
    milestones: input.milestones ?? [],
    roadmap: input.roadmap ?? [],
    risks: input.risks ?? [],
    createdAt: now,
    updatedAt: now,
  }

  saveProjects([...loadProjects(), project])
  return project
}

export function updateProject(
  id: string,
  patch: Partial<
    Pick<
      Project,
      | 'title'
      | 'description'
      | 'status'
      | 'priority'
      | 'deadline'
      | 'owner'
      | 'team'
      | 'progress'
      | 'milestones'
      | 'roadmap'
      | 'risks'
      | 'workspaceId'
    >
  >,
): Project | null {
  const projects = loadProjects()
  const index = projects.findIndex((item) => item.id === id)
  if (index === -1) return null

  const now = new Date().toISOString()
  const current = projects[index]
  const updated: Project = {
    ...current,
    title: patch.title !== undefined ? patch.title.trim() : current.title,
    description: patch.description !== undefined ? patch.description.trim() : current.description,
    status: patch.status ?? current.status,
    priority: patch.priority ?? current.priority,
    deadline: patch.deadline !== undefined ? patch.deadline : current.deadline,
    owner: patch.owner !== undefined ? patch.owner.trim() : current.owner,
    team: patch.team ?? current.team,
    progress: patch.progress !== undefined ? clampProgress(patch.progress) : current.progress,
    milestones: patch.milestones ?? current.milestones,
    roadmap: patch.roadmap ?? current.roadmap,
    risks: patch.risks ?? current.risks,
    workspaceId: patch.workspaceId ?? current.workspaceId,
    updatedAt: now,
  }

  const next = [...projects]
  next[index] = updated
  saveProjects(next)
  return updated
}

export function isProjectsSeeded(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(SEED_FLAG_KEY) === '1'
}

export function markProjectsSeeded(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SEED_FLAG_KEY, '1')
  } catch {
    /* noop */
  }
}

export {
  createMilestone,
  createProjectRisk,
  createProjectTeamMember,
  createRoadmapItem,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  STORAGE_KEY,
}
