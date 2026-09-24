/**
 * IT Company — dedicated frontend module.
 *
 * Public surface: access policy and route table. Page components are lazy
 * inside `routes.ts` and must not be re-exported here — Shell imports access
 * only, and a page barrel would pull those modules into the Shell chunk.
 */
export { canViewITCompany } from './access'
export { IT_COMPANY_ROUTES, IT_COMPANY_BASE_PATH, type ItCompanyRoute } from './routes'
export {
  MISSION_CONTROL_ACTIVITY,
  MISSION_CONTROL_INSPECTOR,
  MISSION_CONTROL_NAV,
  MISSION_CONTROL_WORKSPACE,
} from './mission-control'
