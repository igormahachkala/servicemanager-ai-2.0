export type ProjectTeamRole = 'lead' | 'developer' | 'qa' | 'architect' | 'pm' | 'designer' | 'member'

export type ProjectTeamMember = {
  employeeId: string
  role: ProjectTeamRole
  label: string
}

export type CreateProjectTeamMemberInput = {
  employeeId: string
  role?: ProjectTeamRole
  label?: string
}

const TEAM_ROLES: ProjectTeamRole[] = [
  'lead',
  'developer',
  'qa',
  'architect',
  'pm',
  'designer',
  'member',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseTeamRole(value: unknown): ProjectTeamRole {
  if (typeof value === 'string' && TEAM_ROLES.includes(value as ProjectTeamRole)) {
    return value as ProjectTeamRole
  }
  return 'member'
}

export function parseProjectTeamMember(value: unknown): ProjectTeamMember | null {
  if (!isRecord(value)) return null
  if (typeof value.employeeId !== 'string') return null

  return {
    employeeId: value.employeeId,
    role: parseTeamRole(value.role),
    label: typeof value.label === 'string' ? value.label : '',
  }
}

export function createProjectTeamMember(input: CreateProjectTeamMemberInput): ProjectTeamMember {
  return {
    employeeId: input.employeeId,
    role: input.role ?? 'member',
    label: (input.label ?? '').trim(),
  }
}

export { TEAM_ROLES }
