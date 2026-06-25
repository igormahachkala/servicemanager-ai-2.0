import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  applyApprovalAction,
  cancelApproval,
  computeApprovalStats,
  ensureSeedApprovals,
  filterApprovals,
  getActionsForApproval,
  getApprovalById,
  loadApprovalStore,
  searchApprovals,
  type ApplyApprovalActionInput,
  type Approval,
  type ApprovalActionRecord,
  type ApprovalFilter,
  type ApprovalPolicy,
  type ApprovalStats,
} from '../domain/approval/approvalStorage'

export function useApprovals() {
  const [store, setStore] = useState(() => ensureSeedApprovals())
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ApprovalFilter>({
    status: 'all',
    actionType: 'all',
    priority: 'all',
    workspaceId: 'all',
  })

  const refresh = useCallback(() => {
    ensureSeedApprovals()
    setStore(loadApprovalStore())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'ai-company-approvals') refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const filtered = useMemo(() => {
    const searched = searchApprovals(store.approvals, query)
    return filterApprovals(searched, filter).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
  }, [store.approvals, query, filter])

  const stats = useMemo(() => computeApprovalStats(store.approvals), [store.approvals])

  const applyAction = useCallback(
    (input: ApplyApprovalActionInput) => {
      const result = applyApprovalAction(input)
      refresh()
      return result
    },
    [refresh],
  )

  const cancel = useCallback(
    (approvalId: string) => {
      const result = cancelApproval(approvalId)
      refresh()
      return result
    },
    [refresh],
  )

  return {
    approvals: store.approvals,
    policies: store.policies,
    filtered,
    stats,
    query,
    setQuery,
    filter,
    setFilter,
    refresh,
    applyAction,
    cancel,
    getApprovalById: (id: string) => getApprovalById(id, store),
    getActionsForApproval: (approvalId: string) => getActionsForApproval(approvalId, store),
  }
}

export function useApprovalDetails(id: string | undefined) {
  const { getApprovalById, getActionsForApproval, applyAction, cancel, refresh } = useApprovals()

  const approval = useMemo(
    () => (id ? getApprovalById(id) : null),
    [getApprovalById, id],
  )

  const actions = useMemo(
    () => (id ? getActionsForApproval(id) : []),
    [getActionsForApproval, id],
  )

  return { approval, actions, applyAction, cancel, refresh }
}

export type {
  Approval,
  ApprovalActionRecord,
  ApprovalFilter,
  ApprovalPolicy,
  ApprovalStats,
}
