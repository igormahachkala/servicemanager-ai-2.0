import type { ApprovalActionType } from './approval'
import type { ApprovalRule } from './approvalRule'

export type ApprovalPolicy = {
  id: string
  actionType: ApprovalActionType
  rule: ApprovalRule
  label: string
  description: string
}
