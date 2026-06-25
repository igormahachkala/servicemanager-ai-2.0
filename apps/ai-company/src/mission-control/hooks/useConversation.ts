import { useCallback, useEffect, useState } from 'react'
import {
  appendEmployeeMessage,
  appendOwnerMessage,
  buildMockReply,
  getConversationByEmployeeId,
  getOrCreateConversation,
  loadConversations,
  resolveEmployee,
  type Conversation,
  type EmployeeRef,
} from '../data/conversation'

type ConversationLabels = {
  systemWelcome: (name: string) => string
  ownerName: string
  mockReplies: string[]
}

export function useConversation(employeeId: string | undefined, labels: ConversationLabels) {
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [employee, setEmployee] = useState<EmployeeRef | null>(null)

  const refresh = useCallback(() => {
    if (!employeeId) {
      setConversation(null)
      setEmployee(null)
      return
    }

    const resolved = resolveEmployee(employeeId)
    setEmployee(resolved)
    if (!resolved) {
      setConversation(null)
      return
    }

    let current = getConversationByEmployeeId(employeeId)
    if (!current) {
      current = getOrCreateConversation(employeeId, {
        systemWelcome: labels.systemWelcome,
      })
    }
    setConversation(current)
  }, [employeeId, labels.systemWelcome])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'ai-company-conversations') refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const sendOwnerMessage = useCallback(
    (content: string) => {
      if (!employeeId || !employee) return null

      const updated = appendOwnerMessage(employeeId, content, labels.ownerName)
      if (!updated) return null

      const reply = buildMockReply(employee.codename, labels.mockReplies)
      const withReply = appendEmployeeMessage(employeeId, employee, reply)
      const result = withReply ?? updated
      setConversation(loadConversations().find((item) => item.employeeId === employeeId) ?? result)
      return result
    },
    [employee, employeeId, labels.mockReplies, labels.ownerName],
  )

  return { conversation, employee, sendOwnerMessage, refresh }
}
