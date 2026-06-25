import { useCallback, useEffect, useState } from 'react'
import type {
  Chat,
  CreateDirectChatInput,
  CreateGroupChatInput,
  CreateWorkspaceChatInput,
} from '../domain/chats/chat'
import {
  createDirectChat,
  createGroupChat,
  createWorkspaceChat,
  loadAllChats,
  readStorageKeys,
} from '../domain/chats/chatStorage'

export function useChats() {
  const [chats, setChats] = useState<Chat[]>(() => loadAllChats())

  const refresh = useCallback(() => {
    setChats(loadAllChats())
  }, [])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key && readStorageKeys().includes(event.key)) refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const createDirect = useCallback((input: CreateDirectChatInput): Chat => {
    const created = createDirectChat(input)
    refresh()
    return created
  }, [refresh])

  const createGroup = useCallback((input: CreateGroupChatInput): Chat => {
    const created = createGroupChat(input)
    refresh()
    return created
  }, [refresh])

  const createWorkspace = useCallback((input: CreateWorkspaceChatInput): Chat => {
    const created = createWorkspaceChat(input)
    refresh()
    return created
  }, [refresh])

  return { chats, createDirect, createGroup, createWorkspace, refresh }
}
