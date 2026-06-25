import {
  COMPANY_ASSIGNMENT_STATUSES,
  type CompanyAssignment,
  type CompanyAssignmentStatus,
  type CreateCompanyAssignmentInput,
} from './companyAssignment'

const STORAGE_KEY = 'ai-company-company-assignments'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseStatus(value: unknown): CompanyAssignmentStatus {
  if (
    typeof value === 'string' &&
    (COMPANY_ASSIGNMENT_STATUSES as readonly string[]).includes(value)
  ) {
    return value as CompanyAssignmentStatus
  }
  return 'active'
}

function parseAssignment(value: unknown): CompanyAssignment | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.companyId !== 'string' ||
    typeof value.employeeId !== 'string' ||
    typeof value.role !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    companyId: value.companyId,
    employeeId: value.employeeId,
    role: value.role,
    title: value.title,
    status: parseStatus(value.status),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

export function loadCompanyAssignments(): CompanyAssignment[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseAssignment).filter((item): item is CompanyAssignment => item !== null)
  } catch {
    return []
  }
}

export function saveCompanyAssignments(assignments: CompanyAssignment[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments))
  } catch {
    /* noop */
  }
}

export function getCompanyAssignmentsByCompany(companyId: string): CompanyAssignment[] {
  return loadCompanyAssignments().filter((item) => item.companyId === companyId)
}

export function getCompanyAssignmentsByEmployee(employeeId: string): CompanyAssignment[] {
  return loadCompanyAssignments().filter((item) => item.employeeId === employeeId)
}

export function createCompanyAssignment(input: CreateCompanyAssignmentInput): CompanyAssignment {
  const now = new Date().toISOString()
  const assignment: CompanyAssignment = {
    id: `co-assign-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    companyId: input.companyId,
    employeeId: input.employeeId,
    role: input.role.trim(),
    title: input.title.trim(),
    status: input.status ?? 'active',
    createdAt: now,
    updatedAt: now,
  }
  saveCompanyAssignments([...loadCompanyAssignments(), assignment])
  return assignment
}

export function ensureSeedCompanyAssignments(defaultCompanyId: string): void {
  if (loadCompanyAssignments().length > 0) return

  const now = new Date().toISOString()
  const seeds: CompanyAssignment[] = [
    {
      id: 'co-assign-ceo',
      companyId: defaultCompanyId,
      employeeId: 'ag-ceo',
      role: 'Executive',
      title: 'CEO',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'co-assign-cto',
      companyId: defaultCompanyId,
      employeeId: 'ag-cto',
      role: 'Engineering',
      title: 'CTO',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'co-assign-qa',
      companyId: defaultCompanyId,
      employeeId: 'ag-qa',
      role: 'Quality',
      title: 'QA Lead',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
  ]

  saveCompanyAssignments(seeds)
}
