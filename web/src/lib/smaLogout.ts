export type SmaLogoutDeps = {
  getToken: () => string | null
  isImpersonating: () => boolean
  revokeMaxBinding: () => Promise<unknown>
  clearToken: () => void
}

/**
 * User-initiated SMA logout. Revokes MaxUserBinding while the JWT is still valid,
 * then drops the local session. Impersonation and already-empty sessions skip revoke:
 * the JWT is not the real account, or there is nothing to authorize DELETE with.
 */
export async function runSmaLogout(deps: SmaLogoutDeps): Promise<void> {
  if (deps.getToken() && !deps.isImpersonating()) {
    try {
      await deps.revokeMaxBinding()
    } catch {
      // Local logout still happens: a dead token must not trap the person in the app.
    }
  }
  deps.clearToken()
}
