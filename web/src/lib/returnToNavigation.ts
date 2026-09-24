const RETURN_TO_ALLOWED_PATHS = [
  '/',
  '/archive',
  '/board',
  '/dashboard',
  '/tickets',
  '/objects',
  '/equipment',
  '/users',
  '/contractors',
  '/acts',
  '/permissions',
  '/access-constructor',
  '/assistant',
  '/companies',
  '/service-contracts',
  '/locations',
  '/employees',
  '/specializations',
  '/analytics',
  '/workforce',
  '/settings',
  '/company',
  '/platform',
  '/technician',
  '/map',
  '/problem-categories',
  '/inspection',
  '/agents',
  '/m',
  '/max',
  '/workspaces',
]

const RETURN_TO_FORBIDDEN_PATHS = ['/login', '/logout', '/register', '/request-access']

function isAllowedReturnToPath(pathname: string) {
  if (RETURN_TO_FORBIDDEN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return false
  return RETURN_TO_ALLOWED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

export function sanitizeInternalAppPath(value?: string | null): string {
  const raw = (value || '').trim()
  if (!raw) return ''
  if (!raw.startsWith('/')) return ''
  if (raw.startsWith('//') || raw.startsWith('/\\')) return ''
  if (/^[a-z][a-z\d+.-]*:/i.test(raw)) return ''

  try {
    const url = new URL(raw, 'https://servicemanager.local')
    if (!isAllowedReturnToPath(url.pathname)) return ''
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return ''
  }
}

export function currentInternalAppPath(): string {
  if (typeof window === 'undefined') return ''
  return sanitizeInternalAppPath(`${window.location.pathname}${window.location.search}${window.location.hash}`)
}

const WORKSPACE_IDS = ['management', 'mobile', 'it'] as const
export type WorkspaceQueryId = (typeof WORKSPACE_IDS)[number]

function sanitizeWorkspaceId(value?: string | null): WorkspaceQueryId | '' {
  const raw = (value || '').trim()
  return (WORKSPACE_IDS as readonly string[]).includes(raw) ? (raw as WorkspaceQueryId) : ''
}

/**
 * SMA-MOBILE-MANAGEMENT-NAVIGATION-116E.
 *
 * Какому контуру принадлежит внутренний путь.
 *
 * Зачем: на экране выбора контура `returnTo` применялся к любой выбранной
 * карточке. Техник уходил из мобильной версии в управленческую часть, в адресе
 * оставался `returnTo=/m/...`, и выбор «Управленческая часть» возвращал его
 * обратно в мобильную — петля, из которой в управленческую часть не попасть.
 *
 * Разметка простая и совпадает с карточками контуров: `/m` и `/max` — мобильный
 * контур, `/it` — IT Company, остальные разрешённые пути — управленческая часть.
 * `/workspaces` не принадлежит ни одному: это сам экран выбора, и возврат на
 * него был бы второй петлёй.
 */
const MOBILE_RETURN_TO_PREFIXES = ['/m', '/max']
const IT_RETURN_TO_PREFIXES = ['/it']
const WORKSPACE_SELECTOR_PATHS = ['/workspaces']

function matchesPrefix(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function workspaceForInternalPath(value?: string | null): WorkspaceQueryId | '' {
  const safe = sanitizeInternalAppPath(value)
  if (!safe) return ''

  let pathname = safe
  try {
    pathname = new URL(safe, 'https://servicemanager.local').pathname
  } catch {
    return ''
  }

  // Сам экран выбора контура ничьим не является.
  if (matchesPrefix(pathname, WORKSPACE_SELECTOR_PATHS)) return ''
  if (matchesPrefix(pathname, MOBILE_RETURN_TO_PREFIXES)) return 'mobile'
  if (matchesPrefix(pathname, IT_RETURN_TO_PREFIXES)) return 'it'
  return 'management'
}

/**
 * `returnTo`, годный для выбранного контура, иначе пустая строка.
 *
 * Вызывающий на пустой ответ уходит на домашний путь контура — именно того,
 * который человек выбрал, а не того, откуда он пришёл.
 */
export function returnToForWorkspace(
  returnTo?: string | null,
  workspace?: string | null,
): string {
  const safe = sanitizeInternalAppPath(returnTo)
  if (!safe) return ''
  const ws = sanitizeWorkspaceId(workspace)
  if (!ws) return ''
  return workspaceForInternalPath(safe) === ws ? safe : ''
}

export function getReturnToFromSearch(search: string | URLSearchParams): string {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search
  return sanitizeInternalAppPath(params.get('returnTo') || params.get('next'))
}

export function getWorkspaceFromSearch(search: string | URLSearchParams): WorkspaceQueryId | '' {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search
  return sanitizeWorkspaceId(params.get('workspace'))
}

export function loginPathWithReturnTo(returnTo?: string | null): string {
  const safe = sanitizeInternalAppPath(returnTo)
  return safe ? `/login?returnTo=${encodeURIComponent(safe)}` : '/login'
}

export function workspacePathWithReturnTo(returnTo?: string | null, workspace?: string | null): string {
  const params = new URLSearchParams()
  const safe = sanitizeInternalAppPath(returnTo)
  if (safe) params.set('returnTo', safe)
  const ws = sanitizeWorkspaceId(workspace)
  if (ws) params.set('workspace', ws)
  const qs = params.toString()
  return qs ? `/workspaces?${qs}` : '/workspaces'
}
