import { useCallback, useEffect, useState } from 'react'
import {
  appendEmployeeMessages,
  appendOwnerMessage,
  buildMockReplyContent,
  createDiscussion,
  getDiscussionById,
  loadDiscussions,
  pickMockResponders,
  resolveRosterEntry,
  type CreateDiscussionInput,
  type Discussion,
} from '../data/discussion'

type CreateLabels = {
  ownerName: string
  systemStarted: (names: string) => string
}

type MockLabels = {
  mockReplies: string[]
}

export function useDiscussions() {
  const [discussions, setDiscussions] = useState<Discussion[]>(() => loadDiscussions())

  const refresh = useCallback(() => {
    setDiscussions(loadDiscussions())
  }, [])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'ai-company-discussions') refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const create = useCallback(
    (input: CreateDiscussionInput, labels: CreateLabels): Discussion => {
      const created = createDiscussion(input, labels)
      setDiscussions(loadDiscussions())
      return created
    },
    [],
  )

  const sendOwnerMessage = useCallback(
    (discussionId: string, content: string, ownerName: string, mockLabels: MockLabels): Discussion | null => {
      const updated = appendOwnerMessage(discussionId, content, ownerName)
      if (!updated) return null

      const responders = pickMockResponders(updated)
      const replies = responders.map((participant) => {
        const entry = resolveRosterEntry(participant.employeeId)
        const codename = entry?.codename ?? participant.employeeId
        return {
          employeeId: participant.employeeId,
          displayName: codename,
          content: buildMockReplyContent(codename, mockLabels.mockReplies),
        }
      })

      const withReplies = appendEmployeeMessages(discussionId, replies)
      setDiscussions(loadDiscussions())
      return withReplies ?? updated
    },
    [],
  )

  const getById = useCallback((id: string): Discussion | null => {
    return getDiscussionById(id)
  }, [])

  return { discussions, create, sendOwnerMessage, getById, refresh }
}
