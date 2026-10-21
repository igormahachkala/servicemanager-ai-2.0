import type { Role } from '../lib/api'

/**
 * UI access policy for the IT Company module.
 *
 * Strictly PLATFORM_ADMIN. This intentionally does NOT use
 * `canAccessEngineeringAgent` (that owner-email flag gates the legacy
 * Engineering Agent screen / the service API, not this product UI).
 *
 * Backend guards remain the source of truth for the AgentTask API; this only
 * decides what the desktop UI shows and lets through.
 */
export function canViewITCompany(user?: { role?: Role | null } | null): boolean {
  return user?.role === 'PLATFORM_ADMIN'
}
