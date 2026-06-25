export type ChatType = 'direct' | 'group' | 'workspace' | 'system'

export type ChatStatus = 'active' | 'archived' | 'closed'

export const CHAT_TYPES: ChatType[] = ['direct', 'group', 'workspace', 'system']

export const CHAT_STATUSES: ChatStatus[] = ['active', 'archived', 'closed']

export type ChatSource = 'native' | 'conversation' | 'discussion' | 'virtual'

export type ChatRef =
  | { source: 'native'; id: string }
  | { source: 'conversation'; employeeId: string }
  | { source: 'discussion'; discussionId: string }
  | { source: 'virtual'; id: string }

export function chatIdFromRef(ref: ChatRef): string {
  switch (ref.source) {
    case 'native':
      return ref.id
    case 'conversation':
      return `conv:${ref.employeeId}`
    case 'discussion':
      return `disc:${ref.discussionId}`
    case 'virtual':
      return ref.id
  }
}

export function parseChatRef(chatId: string): ChatRef | null {
  if (chatId.startsWith('conv:')) {
    const employeeId = chatId.slice(5)
    return employeeId ? { source: 'conversation', employeeId } : null
  }
  if (chatId.startsWith('disc:')) {
    const discussionId = chatId.slice(5)
    return discussionId ? { source: 'discussion', discussionId } : null
  }
  if (chatId.startsWith('sys:')) {
    return { source: 'virtual', id: chatId }
  }
  return { source: 'native', id: chatId }
}
