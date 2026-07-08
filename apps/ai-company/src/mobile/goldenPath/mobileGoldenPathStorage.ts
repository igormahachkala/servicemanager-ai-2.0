export const MOBILE_GOLDEN_PATH_SESSION_KEY = 'ai-company-mobile-golden-path-active'

export function setMobileGoldenPathActive(active: boolean): void {
  try {
    if (active) {
      sessionStorage.setItem(MOBILE_GOLDEN_PATH_SESSION_KEY, '1')
    } else {
      sessionStorage.removeItem(MOBILE_GOLDEN_PATH_SESSION_KEY)
    }
  } catch {
    // ignore private mode
  }
}

export function isMobileGoldenPathActive(): boolean {
  try {
    return sessionStorage.getItem(MOBILE_GOLDEN_PATH_SESSION_KEY) === '1'
  } catch {
    return false
  }
}
