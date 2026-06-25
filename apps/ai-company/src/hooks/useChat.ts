import { useCallback, useEffect, useState } from 'react'
import type { Chat } from '../domain/chats/chat'
import {
  appendMockEmployeeReplies,
  appendOwnerMessageToChat,
  buildMockReply,
  getChatById,
  isChatWritable,
  pickChatMockResponders,
  readStorageKeys,
} from '../domain/chats/chatStorage'

type ChatLabels = {
  ownerName: string
  mockReplies: string[]
}

export function useChat(chatId: string | undefined) {
  const [chat, setChat] = useState<Chat | null>(() =>
    chatId ? getChatById(chatId) : null,
  )

  const refresh = useCallback(() => {
    if (!chatId) {
      setChat(null)
      return
    }
    setChat(getChatById(chatId))
  }, [chatId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key && readStorageKeys().includes(event.key)) refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const sendOwnerMessage = useCallback(
    (content: string, labels: ChatLabels): Chat | null => {
      if (!chatId || !chat || !isChatWritable(chat)) return null

      const updated = appendOwnerMessageToChat(chatId, content, labels.ownerName)
      if (!updated) return null

      const responders = pickChatMockResponders(updated)
      const replies = responders
        .filter((participant) => participant.employeeId)
        .map((participant) => ({
          employeeId: participant.employeeId as string,
          displayName: participant.displayName,
          content: buildMockReply(participant.displayName, labels.mockReplies),
        }))

      const withReplies = appendMockEmployeeReplies(chatId, replies)
      const result = withReplies ?? updated
      setChat(getChatById(chatId) ?? result)
      return result
    },
    [chat, chatId],
  )

  return {
    chat,
    sendOwnerMessage,
    refresh,
  }
}
