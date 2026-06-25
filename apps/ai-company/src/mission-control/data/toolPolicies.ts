export const TOOL_POLICIES = [
  'always-allowed',
  'require-approval',
  'workspace-only',
  'owner-only',
  'disabled',
] as const

export type ToolAccessPolicy = (typeof TOOL_POLICIES)[number]

export const POLICY_SEVERITY: Record<ToolAccessPolicy, 'low' | 'medium' | 'high' | 'blocked'> = {
  'always-allowed': 'low',
  'require-approval': 'medium',
  'workspace-only': 'medium',
  'owner-only': 'high',
  disabled: 'blocked',
}
