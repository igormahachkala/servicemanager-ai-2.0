export type MobileRouteRoot = '/m' | '/max'

export function getMobileRouteRoot(pathname?: string | null): MobileRouteRoot {
  const path = (pathname || (typeof window !== 'undefined' ? window.location.pathname : '') || '/m').trim()
  return path.startsWith('/max') ? '/max' : '/m'
}

export function mobilePath(pathname: string | null | undefined, suffix: string): string {
  const root = getMobileRouteRoot(pathname)
  const next = suffix.startsWith('/') ? suffix : `/${suffix}`
  return `${root}${next}`
}
