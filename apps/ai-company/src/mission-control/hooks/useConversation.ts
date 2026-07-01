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
import { resolveCanonicalEmployeeId } from '../data/employeeIdResolver'

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

    const canonicalId = resolveCanonicalEmployeeId(employeeId)
    const resolved = resolveEmployee(canonicalId)
    setEmployee(resolved)
    if (!resolved) {
      setConversation(null)
      return
    }

    let current = getConversationByEmployeeId(canonicalId)
    if (!current) {
      current = getOrCreateConversation(canonicalId, {
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

      const canonicalId = resolveCanonicalEmployeeId(employeeId)
      const updated = appendOwnerMessage(canonicalId, content, labels.ownerName)
      if (!updated) return null

      const reply = buildMockReply(employee.codename, labels.mockReplies)
      const withReply = appendEmployeeMessage(canonicalId, employee, reply)
      const result = withReply ?? updated
      setConversation(loadConversations().find((item) => item.employeeId === canonicalId) ?? result)
      return result
    },
    [employee, employeeId, labels.mockReplies, labels.ownerName],
  )

  return { conversation, employee, sendOwnerMessage, refresh }
}
