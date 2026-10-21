import * as api from '../lib/api'
import { getMaxEnvironmentContext, getWebApp, loadMaxBridgeScript } from './maxBridge'

export type MaxChatBindingSyncResult = 'bound' | 'skipped' | 'failed'

/**
 * Mini App JWT is not a chat identity. Chat `/start` reads MaxUserBinding.
 * Any SMA session inside MAX can complete the ceremony: login, `/m` and `/max`.
 * Desktop without initData still skips — there is no MAX user to bind.
 */
export async function syncMaxChatBinding(initData?: string): Promise<MaxChatBindingSyncResult> {
  if (api.isImpersonating() || !api.getToken()) return 'skipped'

  let payload = (initData || '').trim()
  if (!payload) {
    payload = (getMaxEnvironmentContext().initData || '').trim()
  }
  if (!payload) {
    try {
      await loadMaxBridgeScript()
    } catch {
      // Bridge may already be present, or this is a plain browser.
    }
    payload = (getMaxEnvironmentContext().initData || getWebApp()?.initData || '').trim()
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
