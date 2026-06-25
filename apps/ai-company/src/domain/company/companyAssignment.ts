export const COMPANY_ASSIGNMENT_STATUSES = ['active', 'paused', 'ended'] as const

export type CompanyAssignmentStatus = (typeof COMPANY_ASSIGNMENT_STATUSES)[number]

/** Links platform Employee identity to a Company — employees are not owned by the company. */
export type CompanyAssignment = {
  id: string
  companyId: string
  employeeId: string
  role: string
  title: string
  status: CompanyAssignmentStatus
  createdAt: string
  updatedAt: string
}

export type CreateCompanyAssignmentInput = {
  companyId: string
  employeeId: string
  role: string
  title: string
  status?: CompanyAssignmentStatus
}
