import { loadAuditEvents, saveAuditEvents } from '../audit/auditStorage'
import { ensureSeedOrganization, saveOrganization } from '../organization/organizationStorage'
import { ensureSeedReports, loadReports, saveReports } from '../reports/reportStorage'
import { ensureSeedExecutions } from '../execution/executionSeed'
import { ensureSeedProjects } from '../projects/projectSeed'
import { initializePresenceEngine } from '../presence/presenceEngine'
import { initializeHandoffEngine } from '../handoff/handoffStorage'
import { initializeSprintEngine } from '../sprint/sprintStorage'
import { initializeWorkdayEngine } from '../workday/workdayEngine'
import { initializeRuntimeProviders } from '../runtime/providers/runtimeAdapter'
import { initializeToolExecutionEngine } from '../toolExecution/toolExecutionStorage'
import { initializeToolExecutionRunStorage } from '../toolExecution/toolExecutionRunStorage'
import { loadWorkspaces, saveWorkspaces } from '../workspaces/workspace'
import { DEFAULT_COMPANY_ID } from './company'
import { ensureSeedCompanies } from './companyStorage'
import { ensureSeedCompanyAssignments } from './companyAssignmentStorage'

let migrated = false

/** Attach legacy local entities to the default Company tenant. */
export function migrateEntitiesToCompanies(): string {
  const companies = ensureSeedCompanies()
  const defaultId = companies.find((item) => item.id === DEFAULT_COMPANY_ID)?.id ?? companies[0]?.id ?? DEFAULT_COMPANY_ID

  ensureSeedCompanyAssignments(defaultId)
  ensureSeedProjects()
  ensureSeedExecutions()
  initializePresenceEngine()
  initializeHandoffEngine()
  initializeSprintEngine()
  initializeWorkdayEngine()
  initializeRuntimeProviders()
  initializeToolExecutionEngine()
  initializeToolExecutionRunStorage()

  if (!migrated) {
    const workspaces = loadWorkspaces()
    const wsNext = workspaces.map((item) =>
      item.companyId ? item : { ...item, companyId: defaultId },
    )
    if (wsNext.some((item, index) => item.companyId !== workspaces[index]?.companyId)) {
      saveWorkspaces(wsNext)
    }

    const org = ensureSeedOrganization()
    const deptNext = org.departments.map((item) =>
      item.companyId ? item : { ...item, companyId: defaultId },
    )
    if (deptNext.some((item, index) => item.companyId !== org.departments[index]?.companyId)) {
      saveOrganization({ ...org, departments: deptNext })
    }

    const reports = loadReports()
    if (reports.length === 0) {
      ensureSeedReports()
    }
    const reportsLoaded = loadReports()
    const reportNext = reportsLoaded.map((item) =>
      item.companyId ? item : { ...item, companyId: defaultId },
    )
    if (reportNext.some((item, index) => item.companyId !== reportsLoaded[index]?.companyId)) {
      saveReports(reportNext)
    }

    const audits = loadAuditEvents()
    const auditNext = audits.map((item) =>
      item.companyId ? item : { ...item, companyId: defaultId },
    )
    if (auditNext.some((item, index) => item.companyId !== audits[index]?.companyId)) {
      saveAuditEvents(auditNext)
    }

    migrated = true
  }

  return defaultId
}

export function initializeCompanyEngine(): void {
  migrateEntitiesToCompanies()
}
