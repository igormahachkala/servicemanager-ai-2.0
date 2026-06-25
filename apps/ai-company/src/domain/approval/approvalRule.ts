export const APPROVAL_RULES = [
  'always_required',
  'owner_only',
  'manager',
  'workspace_admin',
  'auto_approve',
  'disabled',
] as const

export type ApprovalRule = (typeof APPROVAL_RULES)[number]
