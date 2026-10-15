import type { CompanyType, Role } from './api'
import { resolveAdminProfile } from './resolveAdminProfile'

/** Mirrors PATCH /workforce/settings: only an ADMIN in a PROVIDER contour may write. */
export function canManageWorkforceSettings(input: {
  role?: Role | string | null
  companyType?: CompanyType | null
}): boolean {
  return resolveAdminProfile(input)?.profile === 'PROVIDER_ADMIN'
}
