export type SmaLogoutDeps = {
  getToken: () => string | null
  isImpersonating: () => boolean
  revokeMaxBinding: (initData?: string) => Promise<unknown>
  getMaxInitData?: () => string
  clearToken: () => void
}

/**
 * User-initiated SMA logout. The MAX chat pair is dropped only from Mini App:
 * signed initData names this MAX person. Browser `/m` and desktop skip revoke.
 * Impersonation and empty sessions skip too. Local session is always cleared.
 */
export async function runSmaLogout(deps: SmaLogoutDeps): Promise<void> {
  const initData = (deps.getMaxInitData?.() || '').trim()
  if (deps.getToken() && !deps.isImpersonating() && initData) {
    try {
      await deps.revokeMaxBinding(initData)
    } catch {
      // Local logout still happens: a dead token must not trap the person in the app.
    }
  }
  deps.clearToken()
}
