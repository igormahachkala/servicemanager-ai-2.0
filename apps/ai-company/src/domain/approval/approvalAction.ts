export const APPROVAL_ACTION_KINDS = ['approve', 'reject', 'delegate', 'comment'] as const

export type ApprovalActionKind = (typeof APPROVAL_ACTION_KINDS)[number]

export type ApprovalActionRecord = {
  id: string
  approvalId: string
  kind: ApprovalActionKind
  actorId: string
  actorType: 'owner' | 'employee'
  comment: string | null
  delegateToId: string | null
  createdAt: string
}
