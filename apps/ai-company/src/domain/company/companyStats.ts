import { loadAuditEvents } from '../audit/auditStorage'
import { loadOrganization } from '../organization/organizationStorage'
import { getProjectsByCompanyId } from '../projects/project'
import { loadReports } from '../reports/reportStorage'
import { loadWorkspaces } from '../workspaces/workspace'
import { getCompanyAssignmentsByCompany } from './companyAssignmentStorage'

export type CompanyStats = {
  projects: number
  departments: number
  workspaces: number
  employees: number
  reports: number
  auditEvents: number
  activeProjects: number
  activeAssignments: number
}

export function computeCompanyStats(companyId: string): CompanyStats {
  const projects = getProjectsByCompanyId(companyId)
  const org = loadOrganization()
  const departments = org.departments.filter(
    (item) => !item.companyId || item.companyId === companyId,
  )
  const workspaces = loadWorkspaces().filter((item) => item.companyId === companyId)
  const assignments = getCompanyAssignmentsByCompany(companyId)
  const activeAssignments = assignments.filter((item) => item.status === 'active')
  const employeeIds = new Set(assignments.map((item) => item.employeeId))
  const reports = loadReports().filter((item) => item.companyId === companyId)
  const auditEvents = loadAuditEvents().filter((item) => item.companyId === companyId)

  return {
    projects: projects.length,
    activeProjects: projects.filter((item) => item.status === 'active').length,
    departments: departments.length,
    workspaces: workspaces.length,
    employees: employeeIds.size,
    activeAssignments: activeAssignments.length,
    reports: reports.length,
    auditEvents: auditEvents.length,
  }
}
