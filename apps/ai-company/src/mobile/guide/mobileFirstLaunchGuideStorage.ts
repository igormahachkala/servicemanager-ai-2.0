export const MOBILE_FIRST_LAUNCH_GUIDE_STORAGE_KEY = 'ai-company-mobile-first-launch-completed'

export function isMobileFirstLaunchGuideCompleted(): boolean {
  try {
    return localStorage.getItem(MOBILE_FIRST_LAUNCH_GUIDE_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function markMobileFirstLaunchGuideCompleted(): void {
  try {
    localStorage.setItem(MOBILE_FIRST_LAUNCH_GUIDE_STORAGE_KEY, 'true')
  } catch {
    // ignore quota / private mode
  }
}
