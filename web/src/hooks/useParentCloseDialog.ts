import { useCallback, useState } from 'react'

import {
  PARENT_CLOSE_REQUIRES_CHILD_RESOLUTIONS,
  parentCloseNeedsDialog,
  readParentCloseRefuse,
  unresolvedDescendantsForClose,
  type TicketWithDescendantsForClose,
  type UnresolvedDescendant,
} from '../lib/ticketParentClose'

export type ParentCloseKind = 'ACCEPT' | 'CANCELED'

export type ParentCloseIntent = {
  kind: ParentCloseKind
  items: UnresolvedDescendant[]
}

export function useParentCloseDialog() {
  const [intent, setIntent] = useState<ParentCloseIntent | null>(null)
  const [error, setError] = useState<string | null>(null)

  const beginIfNeeded = useCallback((ticket: TicketWithDescendantsForClose, kind: ParentCloseKind): boolean => {
    const items = unresolvedDescendantsForClose(ticket)
    if (!parentCloseNeedsDialog(items)) return false
    setError(null)
    setIntent({ kind, items })
    return true
  }, [])

  const openFromRefuse = useCallback((err: unknown, kind: ParentCloseKind): boolean => {
    const refuse = readParentCloseRefuse(err)
    if (refuse?.code !== PARENT_CLOSE_REQUIRES_CHILD_RESOLUTIONS) return false
    if (refuse.unresolved.length === 0) return false
    setError(null)
    setIntent({ kind, items: refuse.unresolved })
    return true
  }, [])

  const cancel = useCallback(() => {
    setIntent(null)
    setError(null)
  }, [])

  return { intent, error, setError, beginIfNeeded, openFromRefuse, cancel }
}
