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

export function getReturnToFromSearch(search: string | URLSearchParams): string {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search
  return sanitizeInternalAppPath(params.get('returnTo') || params.get('next'))
}

export function loginPathWithReturnTo(returnTo?: string | null): string {
  const safe = sanitizeInternalAppPath(returnTo)
  return safe ? `/login?returnTo=${encodeURIComponent(safe)}` : '/login'
}

export function workspacePathWithReturnTo(returnTo?: string | null): string {
  const safe = sanitizeInternalAppPath(returnTo)
  return safe ? `/workspaces?returnTo=${encodeURIComponent(safe)}` : '/workspaces'
}
