/**
 * IT Company — dedicated frontend module.
 *
 * Public surface: access policy, routes, and pages. Consumers (router, Shell)
 * should import from here rather than reaching into internal files.
 */
export { canViewITCompany } from './access'
export { IT_COMPANY_ROUTES, IT_COMPANY_BASE_PATH, type ItCompanyRoute } from './routes'
export { ITCompanyPage } from './pages/ITCompanyPage'
export { AIDeveloperPage } from './pages/AIDeveloperPage'
export { AIEmployeesPage } from './pages/AIEmployeesPage'
export { AIEmployeeDetailsPage } from './pages/AIEmployeeDetailsPage'
export { OrgChartPage } from './pages/OrgChartPage'
export { AITasksPage } from './pages/AITasksPage'
export { MissionControlPage } from './pages/MissionControlPage'
export {
  MISSION_CONTROL_ACTIVITY,
  MISSION_CONTROL_INSPECTOR,
  MISSION_CONTROL_NAV,
  MISSION_CONTROL_WORKSPACE,
} from './mission-control'
