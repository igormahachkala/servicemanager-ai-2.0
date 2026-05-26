export type MaxWebAppUser = {
  id?: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
  is_premium?: boolean
}

export type MaxWebAppInitDataUnsafe = {
  user?: MaxWebAppUser
  chat?: Record<string, unknown>
  start_param?: string
  auth_date?: number
  hash?: string
}

export type MaxBackButton = {
  isVisible: boolean
  show(): void
  hide(): void
  onClick(callback: () => void): void
  offClick(callback: () => void): void
}

export type MaxWebApp = {
  platform?: string
  version?: string
  initData?: string
  initDataUnsafe?: MaxWebAppInitDataUnsafe
  BackButton?: MaxBackButton
  ready?(): void
  close?(): void
  expand?(): void
}

declare global {
  interface Window {
    WebApp?: MaxWebApp
  }
}

export function getWebApp(): MaxWebApp | null {
  if (typeof window === 'undefined') return null
  return window.WebApp ?? null
}

export function isMaxEnvironment(): boolean {
  const webApp = getWebApp()
  if (!webApp) return false
  if (typeof webApp.initData === 'string' && webApp.initData.trim()) return true
  const unsafe = webApp.initDataUnsafe
  return Boolean(unsafe?.user || unsafe?.chat || unsafe?.start_param)
}

export type MaxEnvironmentContext = {
  platform?: string
  version?: string
  initData?: string
  user?: MaxWebAppUser
  chat?: Record<string, unknown>
  startParam?: string
  detected: boolean
}

export function getMaxEnvironmentContext(): MaxEnvironmentContext {
  const webApp = getWebApp()
  const unsafe = webApp?.initDataUnsafe
  return {
    platform: webApp?.platform,
    version: webApp?.version,
    initData: webApp?.initData,
    user: unsafe?.user,
    chat: unsafe?.chat,
    startParam: unsafe?.start_param,
    detected: isMaxEnvironment(),
  }
}

export type ParsedStartParam =
  | { type: 'ticket'; ticketId: string }
  | { type: 'unknown'; raw: string }
  | { type: 'none' }

export function parseStartParam(startParam?: string | null): ParsedStartParam {
  if (!startParam) return { type: 'none' }
  if (startParam.startsWith('ticket_')) {
    const ticketId = startParam.slice('ticket_'.length).trim()
    if (ticketId) return { type: 'ticket', ticketId }
  }
  return { type: 'unknown', raw: startParam }
}

export function getStartParamFromLocation(): string | null {
  if (typeof window === 'undefined') return null
  const fromSearch = new URLSearchParams(window.location.search)
  const searchValue =
    fromSearch.get('startapp') || fromSearch.get('start_param') || fromSearch.get('startParam')
  if (searchValue) return searchValue

  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
  if (!hash) return null
  const hashParams = new URLSearchParams(hash.startsWith('?') ? hash.slice(1) : hash)
  return hashParams.get('startapp') || hashParams.get('start_param') || hashParams.get('startParam')
}

export function loadMaxBridgeScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      resolve()
      return
    }
    if (window.WebApp) {
      resolve()
      return
    }
    const existing = document.querySelector('script[data-max-bridge]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Не удалось загрузить MAX Bridge')))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://st.max.ru/js/max-web-app.js'
    script.setAttribute('data-max-bridge', '1')
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Не удалось загрузить MAX Bridge'))
    document.head.appendChild(script)
  })
}
