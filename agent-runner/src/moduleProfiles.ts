/**
 * Module profiles: which files belong to a module and which to load first.
 * Single source of truth for module→paths mapping (used by FileSelector and
 * ContextPlanner). Read-only metadata; no filesystem access here.
 */

export interface ModuleProfile {
  id: string
  keys: string[]
  /** Does a normalized relative path belong to this module? */
  includes: (rel: string) => boolean
  /** Basenames that must be loaded first (the module's core files). */
  anchors: string[]
}

const startsWithAny = (rel: string, prefixes: string[]) => prefixes.some((p) => rel.startsWith(p))

export const PROFILES: ModuleProfile[] = [
  {
    id: 'tickets',
    keys: ['tickets', 'ticket', 'заявк', 'заявка', 'заявки'],
    includes: (r) =>
      startsWithAny(r, ['backend/src/tickets/', 'backend/src/workflow/']) ||
      /^web\/src\/mobile\/MobileTicket/.test(r) ||
      /^web\/src\/views\/.*[Tt]icket/.test(r),
    anchors: ['tickets.controller.ts', 'tickets.service.ts', 'tickets.module.ts'],
  },
  {
    id: 'auth',
    keys: ['auth', 'login', 'jwt', 'token', 'авториз', 'логин'],
    includes: (r) => r.startsWith('backend/src/auth/'),
    anchors: ['auth.controller.ts', 'auth.service.ts', 'auth.module.ts', 'jwt.strategy.ts', 'jwt.guard.ts'],
  },
  {
    id: 'permissions',
    keys: ['permissions', 'permission', 'roles', 'role', 'guard', 'права', 'роли', 'политик', 'policy'],
    includes: (r) => startsWithAny(r, ['backend/src/common/', 'backend/src/policy/']),
    anchors: ['permissions.guard.ts', 'permissions.constants.ts', 'permissions-context.guard.ts', 'roles.guard.ts'],
  },
  {
    id: 'mobile',
    keys: ['mobile', 'мобильн'],
    includes: (r) => r.startsWith('web/src/mobile/'),
    anchors: ['MobileApp.tsx', 'MobileShell.tsx'],
  },
  {
    id: 'analytics',
    keys: ['analytics', 'аналитик', 'метрик', 'metrics'],
    includes: (r) => r.startsWith('backend/src/analytics/') || /^web\/src\/views\/.*[Aa]nalytics/.test(r),
    anchors: ['analytics.controller.ts', 'analytics.service.ts', 'analytics.module.ts'],
  },
  {
    id: 'inspections',
    keys: ['inspection', 'inspections', 'обход', 'обходы', 'patrol'],
    includes: (r) => r.startsWith('backend/src/inspection/'),
    anchors: ['inspection.controller.ts', 'inspection.service.ts', 'inspection.module.ts'],
  },
]

/** First profile whose keyword appears in the task text, else null. */
export function profileForText(text: string): ModuleProfile | null {
  const low = text.toLowerCase()
  for (const p of PROFILES) if (p.keys.some((k) => low.includes(k))) return p
  return null
}

export function isAnchor(profile: ModuleProfile, rel: string): boolean {
  const base = rel.split('/').pop() || rel
  return profile.anchors.includes(base)
}
