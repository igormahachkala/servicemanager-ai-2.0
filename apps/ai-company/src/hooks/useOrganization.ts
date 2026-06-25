import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadCustomEmployees } from '../mission-control/data/customEmployees'
import {
  buildReportingTree,
  computeOrganizationStats,
  ensureSeedOrganization,
  getDepartmentById,
  getEmployeeOrgContext,
  getTeamById,
  getTeamsByDepartment,
  loadOrganization,
  mergeCustomEmployeeMembers,
  type OrganizationData,
  type OrganizationStats,
  type OrganizationTreeNode,
} from '../domain/organization/organizationStorage'

export function useOrganization() {
  const [data, setData] = useState<OrganizationData>(() => ensureSeedOrganization())

  const refresh = useCallback(() => {
    ensureSeedOrganization()
    setData(mergeCustomEmployeeMembers(loadOrganization()))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === 'ai-company-organization' ||
        event.key === 'ai-company-custom-employees'
      ) {
        refresh()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const merged = useMemo(() => mergeCustomEmployeeMembers(data), [data])

  const tree = useMemo(() => buildReportingTree(merged), [merged])
  const stats = useMemo(() => computeOrganizationStats(merged), [merged])

  const customEmployees = useMemo(() => loadCustomEmployees(), [merged])

  return {
    data: merged,
    departments: merged.departments,
    teams: merged.teams,
    reportingLines: merged.reportingLines,
    tree,
    stats,
    customEmployees,
    refresh,
    getDepartmentById: (id: string) => getDepartmentById(id, merged),
    getTeamById: (id: string) => getTeamById(id, merged),
    getTeamsByDepartment: (departmentId: string) => getTeamsByDepartment(departmentId, merged),
    getEmployeeContext: (employeeId: string) => getEmployeeOrgContext(employeeId, merged),
  }
}

export type { OrganizationData, OrganizationStats, OrganizationTreeNode }
