import { UserRole } from '@prisma/client'

export type AgentTaskUserCtx = {
  id: string
  companyId: string
  role: UserRole
  email?: string | null
}

/**
 * Owner emails authorized to use the Engineering Agent module, configured via
 * the optional `ENGINEERING_AGENT_OWNER_EMAILS` env var (comma-separated).
 * No emails are hardcoded — an empty/unset var simply means "PLATFORM_ADMIN only".
 */
export function engineeringAgentOwnerEmails(): string[] {
  return (process.env.ENGINEERING_AGENT_OWNER_EMAILS || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * The Engineering Agent is an owner-only module. Access is granted to the
 * platform super-admin (PLATFORM_ADMIN) or to any explicitly configured owner
 * email. Everyone else is denied — there is no per-role fallback.
 */
export function isEngineeringAgentOwner(user: { role: UserRole; email?: string | null }): boolean {
  if (user.role === UserRole.PLATFORM_ADMIN) return true
  const email = (user.email || '').trim().toLowerCase()
  if (!email) return false
  return engineeringAgentOwnerEmails().includes(email)
}
