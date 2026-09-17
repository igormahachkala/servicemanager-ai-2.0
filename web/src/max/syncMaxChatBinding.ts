import * as api from '../lib/api'
import { getMaxEnvironmentContext, getWebApp, loadMaxBridgeScript } from './maxBridge'

export type MaxChatBindingSyncResult = 'bound' | 'skipped' | 'failed'

function shouldLoadMaxBridge(): boolean {
  if (typeof window === 'undefined') return false
  if (getWebApp()) return false
  if (window.parent !== window) return true
  if (/MaxApp|MAX\//i.test(navigator.userAgent || '')) return true
  return Boolean(document.querySelector('script[data-max-bridge]'))
}

/**
 * Mini App JWT is not a chat identity. Chat `/start` reads MaxUserBinding.
 * Password login often lands on `/m`, outside MaxApp, so the bind ceremony
 * must also run from the mobile shell and from the login page.
 */
export async function syncMaxChatBinding(initData?: string): Promise<MaxChatBindingSyncResult> {
  if (api.isImpersonating() || !api.getToken()) return 'skipped'

  let payload = (initData || '').trim()
  if (!payload) {
    payload = (getMaxEnvironmentContext().initData || '').trim()
  }
  if (!payload && shouldLoadMaxBridge()) {
    try {
      await loadMaxBridgeScript()
    } catch {
      return 'skipped'
    }
    payload = (getMaxEnvironmentContext().initData || '').trim()
  }
  if (!payload) return 'skipped'

  try {
    const { binding } = await api.getMaxBinding()
    if (binding) return 'bound'
  } catch {
    // GET is a hint. POST is the ceremony.
  }

  try {
    await api.createMaxBinding(payload)
    return 'bound'
  } catch {
    return 'failed'
  }
}
