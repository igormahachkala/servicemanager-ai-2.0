import type { MobileChatTaskProposal } from '../../domain/mobileChatIntent'

export const MOBILE_CHAT_TASK_PREFILL_KEY = 'mobile-chat-task-prefill'

export function stashMobileChatTaskPrefill(proposal: MobileChatTaskProposal): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(MOBILE_CHAT_TASK_PREFILL_KEY, JSON.stringify(proposal))
  } catch {
    /* noop */
  }
}

export function consumeMobileChatTaskPrefill(): MobileChatTaskProposal | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(MOBILE_CHAT_TASK_PREFILL_KEY)
    sessionStorage.removeItem(MOBILE_CHAT_TASK_PREFILL_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const value = parsed as MobileChatTaskProposal
    if (typeof value.title !== 'string' || typeof value.taskText !== 'string') return null
    return value
  } catch {
    return null
  }
}
