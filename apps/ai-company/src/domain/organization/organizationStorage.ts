import { agents } from '../../mission-control/data/mock'
import { loadCustomEmployees } from '../../mission-control/data/customEmployees'
import { resolveEmployee } from '../../mission-control/data/conversation'
import type { Department } from './department'
import type { Team } from './team'
import type { ReportingLine } from './reportingLine'
import type { OrganizationTreeNode } from './organizationNode'

export const OWNER_ID = 'owner'

export type OrganizationData = {
  departments: Department[]
  teams: Team[]
  reportingLines: ReportingLine[]
}

export type OrganizationStats = {
  departments: number
  teams: number
  headcount: number
  activeEmployees: number
  customEmployees: number
  plannedEmployees: number
}

export type EmployeeOrgContext = {
  manager: ReportingLine | null
  directReports: ReportingLine[]
  department: Department | null
  team: Team | null
}

const STORAGE_KEY = 'ai-company-organization'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseDepartment(value: unknown): Department | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.description !== 'string') {
    return null
  }
  return {
    id: value.id,
    name: value.name,
    description: value.description,
    headEmployeeId: typeof value.headEmployeeId === 'string' ? value.headEmployeeId : null,
  }
}

function parseTeam(value: unknown): Team | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.departmentId !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.description !== 'string'
  ) {
    return null
  }
  const members = Array.isArray(value.members)
    ? value.members.filter((item): item is string => typeof item === 'string')
    : []
  return {
    id: value.id,
    departmentId: value.departmentId,
    name: value.name,
    description: value.description,
    leadEmployeeId: typeof value.leadEmployeeId === 'string' ? value.leadEmployeeId : null,
    members,
  }
}

function parseReportingLine(value: unknown): ReportingLine | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.managerId !== 'string' ||
    typeof value.employeeId !== 'string' ||
    typeof value.role !== 'string'
  ) {
    return null
  }
  return {
    id: value.id,
    managerId: value.managerId,
    employeeId: value.employeeId,
    role: value.role,
  }
}

export function loadOrganization(): OrganizationData {
  if (typeof window === 'undefined') {
    return { departments: [], teams: [], reportingLines: [] }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { departments: [], teams: [], reportingLines: [] }
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return { departments: [], teams: [], reportingLines: [] }

    const departments = Array.isArray(parsed.departments)
      ? parsed.departments.map(parseDepartment).filter((item): item is Department => item !== null)
      : []
    const teams = Array.isArray(parsed.teams)
      ? parsed.teams.map(parseTeam).filter((item): item is Team => item !== null)
      : []
    const reportingLines = Array.isArray(parsed.reportingLines)
      ? parsed.reportingLines
          .map(parseReportingLine)
          .filter((item): item is ReportingLine => item !== null)
      : []

    return { departments, teams, reportingLines }
  } catch {
    return { departments: [], teams: [], reportingLines: [] }
  }
}

export function saveOrganization(data: OrganizationData): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* noop */
  }
}

export function ensureSeedOrganization(): OrganizationData {
  const existing = loadOrganization()
  if (existing.departments.length > 0) return existing

  const data: OrganizationData = {
    departments: [
      {
        id: 'dept-executive',
        name: 'Executive',
        description: 'Company leadership — strategy, governance, and Owner alignment.',
        headEmployeeId: 'ag-ceo',
      },
      {
        id: 'dept-engineering',
        name: 'Engineering',
        description: 'Product engineering — architecture, development, and platform delivery.',
        headEmployeeId: 'ag-cto',
      },
      {
        id: 'dept-qa',
        name: 'Quality Assurance',
        description: 'Quality gates, acceptance criteria, and release verification.',
        headEmployeeId: 'ag-qa',
      },
      {
        id: 'dept-marketing',
        name: 'Marketing',
        description: 'Brand, growth, and go-to-market — digital employee-led campaigns.',
        headEmployeeId: null,
      },
      {
        id: 'dept-finance',
        name: 'Finance',
        description: 'Financial planning, billing, and cost allocation for AI operations.',
        headEmployeeId: 'ag-cfo',
      },
      {
        id: 'dept-operations',
        name: 'Operations & Support',
        description: 'DevOps, internal tooling, and customer support operations.',
        headEmployeeId: 'ag-coo',
      },
      {
        id: 'dept-hr',
        name: 'Human Resources',
        description: 'Talent, onboarding, and employee lifecycle for digital workforce.',
        headEmployeeId: null,
      },
      {
        id: 'dept-custom',
        name: 'Custom Talent',
        description: 'Owner-created digital employees — belong to company, not Workspace.',
        headEmployeeId: null,
      },
    ],
    teams: [
      {
        id: 'team-executive',
        departmentId: 'dept-executive',
        name: 'Executive Leadership',
        description: 'CEO, COO, CFO — company-wide decisions.',
        leadEmployeeId: 'ag-ceo',
        members: ['ag-ceo', 'ag-coo', 'ag-cfo'],
      },
      {
        id: 'team-engineering',
        departmentId: 'dept-engineering',
        name: 'Core Engineering',
        description: 'CTO office — platform, architecture, and development.',
        leadEmployeeId: 'ag-cto',
        members: ['ag-cto', 'ag-arch', 'ag-max'],
      },
      {
        id: 'team-qa',
        departmentId: 'dept-qa',
        name: 'QA Engineering',
        description: 'Test strategy, acceptance flows, and build verification.',
        leadEmployeeId: 'ag-qa',
        members: ['ag-qa'],
      },
      {
        id: 'team-marketing',
        departmentId: 'dept-marketing',
        name: 'Marketing',
        description: 'Growth and communications — placeholder until agents assigned.',
        leadEmployeeId: null,
        members: [],
      },
      {
        id: 'team-finance',
        departmentId: 'dept-finance',
        name: 'Finance Ops',
        description: 'Ledger, forecasting, and operational finance.',
        leadEmployeeId: 'ag-cfo',
        members: ['ag-cfo'],
      },
      {
        id: 'team-devops',
        departmentId: 'dept-operations',
        name: 'DevOps',
        description: 'Infrastructure, CI/CD, and local environment health.',
        leadEmployeeId: 'ag-devops',
        members: ['ag-devops'],
      },
      {
        id: 'team-support',
        departmentId: 'dept-operations',
        name: 'Support',
        description: 'Owner assistance and operational support threads.',
        leadEmployeeId: 'ag-asst',
        members: ['ag-asst'],
      },
      {
        id: 'team-hr',
        departmentId: 'dept-hr',
        name: 'People Operations',
        description: 'HR processes for digital employee roster.',
        leadEmployeeId: null,
        members: [],
      },
      {
        id: 'team-custom',
        departmentId: 'dept-custom',
        name: 'Custom Employees',
        description: 'Dynamically assigned custom-built digital employees.',
        leadEmployeeId: null,
        members: [],
      },
    ],
    reportingLines: [
      { id: 'rl-001', managerId: OWNER_ID, employeeId: 'ag-ceo', role: 'CEO' },
      { id: 'rl-002', managerId: 'ag-ceo', employeeId: 'ag-cto', role: 'CTO' },
      { id: 'rl-003', managerId: 'ag-ceo', employeeId: 'ag-coo', role: 'COO' },
      { id: 'rl-004', managerId: 'ag-ceo', employeeId: 'ag-cfo', role: 'CFO' },
      { id: 'rl-005', managerId: 'ag-cto', employeeId: 'ag-arch', role: 'Architect' },
      { id: 'rl-006', managerId: 'ag-cto', employeeId: 'ag-max', role: 'Lead Developer' },
      { id: 'rl-007', managerId: 'ag-cto', employeeId: 'ag-qa', role: 'QA Lead' },
      { id: 'rl-008', managerId: 'ag-coo', employeeId: 'ag-devops', role: 'DevOps Lead' },
      { id: 'rl-009', managerId: 'ag-coo', employeeId: 'ag-asst', role: 'Support Lead' },
    ],
  }

  saveOrganization(data)
  return data
}

export function getDepartmentById(id: string, data?: OrganizationData): Department | null {
  const org = data ?? loadOrganization()
  return org.departments.find((item) => item.id === id) ?? null
}

export function getTeamById(id: string, data?: OrganizationData): Team | null {
  const org = data ?? loadOrganization()
  return org.teams.find((item) => item.id === id) ?? null
}

export function getTeamsByDepartment(departmentId: string, data?: OrganizationData): Team[] {
  const org = data ?? loadOrganization()
  return org.teams.filter((item) => item.departmentId === departmentId)
}

export function mergeCustomEmployeeMembers(data: OrganizationData): OrganizationData {
  const customIds = loadCustomEmployees().map((item) => item.id)
  const teams = data.teams.map((team) => {
    if (team.id !== 'team-custom') return team
    return { ...team, members: customIds }
  })
  return { ...data, teams }
}

export function getManagerLine(employeeId: string, data?: OrganizationData): ReportingLine | null {
  const org = data ?? loadOrganization()
  return org.reportingLines.find((line) => line.employeeId === employeeId) ?? null
}

export function getDirectReportLines(managerId: string, data?: OrganizationData): ReportingLine[] {
  const org = data ?? loadOrganization()
  return org.reportingLines.filter((line) => line.managerId === managerId)
}

export function getEmployeeTeam(employeeId: string, data?: OrganizationData): Team | null {
  const org = mergeCustomEmployeeMembers(data ?? loadOrganization())
  return org.teams.find((team) => team.members.includes(employeeId)) ?? null
}

export function getEmployeeDepartment(employeeId: string, data?: OrganizationData): Department | null {
  const team = getEmployeeTeam(employeeId, data)
  if (!team) return null
  return getDepartmentById(team.departmentId, data)
}

export function getEmployeeOrgContext(employeeId: string, data?: OrganizationData): EmployeeOrgContext {
  const org = mergeCustomEmployeeMembers(data ?? loadOrganization())
  return {
    manager: getManagerLine(employeeId, org),
    directReports: getDirectReportLines(employeeId, org),
    department: getEmployeeDepartment(employeeId, org),
    team: getEmployeeTeam(employeeId, org),
  }
}

function employeeLabel(employeeId: string): string {
  if (employeeId === OWNER_ID) return 'Owner'
  return resolveEmployee(employeeId)?.codename ?? employeeId
}

function buildEmployeeSubtree(
  managerId: string,
  org: OrganizationData,
  sortOrderStart: number,
): OrganizationTreeNode[] {
  const lines = getDirectReportLines(managerId, org)
  return lines.map((line, index) => ({
    id: `node-emp-${line.employeeId}`,
    kind: 'employee' as const,
    refId: line.employeeId,
    label: employeeLabel(line.employeeId),
    subtitle: line.role,
    parentId: managerId === OWNER_ID ? 'node-owner' : `node-emp-${managerId}`,
    sortOrder: sortOrderStart + index,
    children: buildEmployeeSubtree(line.employeeId, org, 0),
  }))
}

export function buildReportingTree(data?: OrganizationData): OrganizationTreeNode {
  const org = mergeCustomEmployeeMembers(data ?? loadOrganization())
  return {
    id: 'node-owner',
    kind: 'owner',
    refId: OWNER_ID,
    label: 'Owner',
    subtitle: 'Human principal',
    parentId: null,
    sortOrder: 0,
    children: buildEmployeeSubtree(OWNER_ID, org, 1),
  }
}

export function computeOrganizationStats(data?: OrganizationData): OrganizationStats {
  const org = mergeCustomEmployeeMembers(data ?? loadOrganization())
  const memberIds = new Set<string>()
  for (const team of org.teams) {
    for (const member of team.members) memberIds.add(member)
  }

  const custom = loadCustomEmployees()
  const activeBuiltin = agents.filter((item) => item.lifecycle === 'active').length
  const plannedBuiltin = agents.filter((item) => item.lifecycle === 'planned').length
  const activeCustom = custom.filter((item) => item.status === 'active').length

  return {
    departments: org.departments.length,
    teams: org.teams.length,
    headcount: memberIds.size,
    activeEmployees: activeBuiltin + activeCustom,
    customEmployees: custom.length,
    plannedEmployees: plannedBuiltin + custom.filter((item) => item.status === 'planned').length,
  }
}

export type { Department } from './department'
export type { Team } from './team'
export type { ReportingLine } from './reportingLine'
export type { OrganizationNode, OrganizationTreeNode } from './organizationNode'
