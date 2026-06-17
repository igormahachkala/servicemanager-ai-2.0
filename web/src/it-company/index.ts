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
