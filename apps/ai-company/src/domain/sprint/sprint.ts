export type SprintStatus = 'planned' | 'active' | 'review' | 'completed' | 'cancelled'

export type SprintHealth = 'on_track' | 'at_risk' | 'blocked'

export type SprintBoardColumn = 'ready' | 'in_sprint' | 'review' | 'done' | 'blocked'

export type SprintCapacityMember = {
  employeeId: string
  codename: string
  role: string
  storyPoints: number
  hours: number
}

export type SprintTaskEntry = {
  taskId: string
  storyPoints: number
  boardColumn: SprintBoardColumn
  order: number
}

export type SprintBurndownPoint = {
  day: string
  label: string
  remaining: number
  ideal: number
}

export type Sprint = {
  id: string
  number: number
  name: string
  projectId: string
  workspaceId: string
  goal: string
  status: SprintStatus
  health: SprintHealth
  startDate: string
  endDate: string
  durationDays: number
  capacity: {
    totalStoryPoints: number
    totalHours: number
    members: SprintCapacityMember[]
  }
  commitment: {
    storyPoints: number
    taskCount: number
  }
  tasks: SprintTaskEntry[]
  assigneeIds: string[]
  definitionOfReady: string[]
  definitionOfDone: string[]
  velocity: number
  burndown: SprintBurndownPoint[]
  reviewNotes: string[]
  createdAt: string
  updatedAt: string
}

export type CreateSprintInput = {
  id?: string
  number: number
  name: string
  projectId: string
  workspaceId: string
  goal: string
  status?: SprintStatus
  startDate: string
  endDate: string
  durationDays: number
  capacity: Sprint['capacity']
  commitment: Sprint['commitment']
  tasks: SprintTaskEntry[]
  assigneeIds: string[]
  definitionOfReady: string[]
  definitionOfDone: string[]
  velocity?: number
  burndown?: SprintBurndownPoint[]
  reviewNotes?: string[]
}

const SPRINT_STATUSES: SprintStatus[] = ['planned', 'active', 'review', 'completed', 'cancelled']
const SPRINT_HEALTHS: SprintHealth[] = ['on_track', 'at_risk', 'blocked']
const BOARD_COLUMNS: SprintBoardColumn[] = ['ready', 'in_sprint', 'review', 'done', 'blocked']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseStatus(value: unknown): SprintStatus {
  if (typeof value === 'string' && SPRINT_STATUSES.includes(value as SprintStatus)) {
    return value as SprintStatus
  }
  return 'planned'
}

function parseHealth(value: unknown): SprintHealth {
  if (typeof value === 'string' && SPRINT_HEALTHS.includes(value as SprintHealth)) {
    return value as SprintHealth
  }
  return 'on_track'
}

function parseBoardColumn(value: unknown): SprintBoardColumn {
  if (typeof value === 'string' && BOARD_COLUMNS.includes(value as SprintBoardColumn)) {
    return value as SprintBoardColumn
  }
  return 'ready'
}

function parseCapacityMember(value: unknown): SprintCapacityMember | null {
  if (!isRecord(value)) return null
  if (typeof value.employeeId !== 'string' || typeof value.codename !== 'string') return null
  return {
    employeeId: value.employeeId,
    codename: value.codename,
    role: typeof value.role === 'string' ? value.role : '',
    storyPoints: typeof value.storyPoints === 'number' ? value.storyPoints : 0,
    hours: typeof value.hours === 'number' ? value.hours : 0,
  }
}

function parseTaskEntry(value: unknown): SprintTaskEntry | null {
  if (!isRecord(value)) return null
  if (typeof value.taskId !== 'string') return null
  return {
    taskId: value.taskId,
    storyPoints: typeof value.storyPoints === 'number' ? value.storyPoints : 3,
    boardColumn: parseBoardColumn(value.boardColumn),
    order: typeof value.order === 'number' ? value.order : 0,
  }
}

function parseBurndownPoint(value: unknown): SprintBurndownPoint | null {
  if (!isRecord(value)) return null
  if (typeof value.day !== 'string' || typeof value.label !== 'string') return null
  return {
    day: value.day,
    label: value.label,
    remaining: typeof value.remaining === 'number' ? value.remaining : 0,
    ideal: typeof value.ideal === 'number' ? value.ideal : 0,
  }
}

export function parseSprint(value: unknown): Sprint | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.projectId !== 'string' ||
    typeof value.workspaceId !== 'string' ||
    typeof value.goal !== 'string' ||
    typeof value.startDate !== 'string' ||
    typeof value.endDate !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }

  const capacityRaw = isRecord(value.capacity) ? value.capacity : {}
  const membersRaw = Array.isArray(capacityRaw.members) ? capacityRaw.members : []
  const commitmentRaw = isRecord(value.commitment) ? value.commitment : {}

  return {
    id: value.id,
    number: typeof value.number === 'number' ? value.number : 1,
    name: value.name,
    projectId: value.projectId,
    workspaceId: value.workspaceId,
    goal: value.goal,
    status: parseStatus(value.status),
    health: parseHealth(value.health),
    startDate: value.startDate,
    endDate: value.endDate,
    durationDays: typeof value.durationDays === 'number' ? value.durationDays : 10,
    capacity: {
      totalStoryPoints:
        typeof capacityRaw.totalStoryPoints === 'number' ? capacityRaw.totalStoryPoints : 0,
      totalHours: typeof capacityRaw.totalHours === 'number' ? capacityRaw.totalHours : 0,
      members: membersRaw
        .map(parseCapacityMember)
        .filter((item): item is SprintCapacityMember => item !== null),
    },
    commitment: {
      storyPoints: typeof commitmentRaw.storyPoints === 'number' ? commitmentRaw.storyPoints : 0,
      taskCount: typeof commitmentRaw.taskCount === 'number' ? commitmentRaw.taskCount : 0,
    },
    tasks: (Array.isArray(value.tasks) ? value.tasks : [])
      .map(parseTaskEntry)
      .filter((item): item is SprintTaskEntry => item !== null),
    assigneeIds: Array.isArray(value.assigneeIds)
      ? value.assigneeIds.filter((item): item is string => typeof item === 'string')
      : [],
    definitionOfReady: Array.isArray(value.definitionOfReady)
      ? value.definitionOfReady.filter((item): item is string => typeof item === 'string')
      : [],
    definitionOfDone: Array.isArray(value.definitionOfDone)
      ? value.definitionOfDone.filter((item): item is string => typeof item === 'string')
      : [],
    velocity: typeof value.velocity === 'number' ? value.velocity : 0,
    burndown: (Array.isArray(value.burndown) ? value.burndown : [])
      .map(parseBurndownPoint)
      .filter((item): item is SprintBurndownPoint => item !== null),
    reviewNotes: Array.isArray(value.reviewNotes)
      ? value.reviewNotes.filter((item): item is string => typeof item === 'string')
      : [],
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

export function createSprint(input: CreateSprintInput): Sprint {
  const now = new Date().toISOString()
  return {
    id: input.id ?? `sprint-${Date.now()}`,
    number: input.number,
    name: input.name,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    goal: input.goal,
    status: input.status ?? 'planned',
    health: 'on_track',
    startDate: input.startDate,
    endDate: input.endDate,
    durationDays: input.durationDays,
    capacity: input.capacity,
    commitment: input.commitment,
    tasks: input.tasks,
    assigneeIds: input.assigneeIds,
    definitionOfReady: input.definitionOfReady,
    definitionOfDone: input.definitionOfDone,
    velocity: input.velocity ?? 0,
    burndown: input.burndown ?? [],
    reviewNotes: input.reviewNotes ?? [],
    createdAt: now,
    updatedAt: now,
  }
}

export function deliveryStatusToBoardColumn(status: string): SprintBoardColumn {
  if (status === 'in_progress') return 'in_sprint'
  if (status === 'review') return 'review'
  if (status === 'done') return 'done'
  if (status === 'blocked') return 'blocked'
  return 'ready'
}

export { SPRINT_STATUSES, SPRINT_HEALTHS, BOARD_COLUMNS }
