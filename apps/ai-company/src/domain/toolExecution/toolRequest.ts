export const TOOL_EXECUTION_PROVIDERS = [
  'mock',
  'mcp',
  'rest',
  'github',
  'docker',
  'filesystem',
  'ssh',
  'browser',
  'postgresql',
  'google',
  'telegram',
  'openrouter',
  'ollama',
] as const

export type ToolExecutionProvider = (typeof TOOL_EXECUTION_PROVIDERS)[number]

export const TOOL_REQUEST_APPROVAL_STATUSES = ['none', 'pending', 'approved', 'rejected'] as const

export type ToolRequestApprovalStatus = (typeof TOOL_REQUEST_APPROVAL_STATUSES)[number]

export type ToolRequestApproval = {
  required: boolean
  approvalId: string | null
  status: ToolRequestApprovalStatus
}

export type ToolRequest = {
  employeeId: string
  toolId: string
  provider: ToolExecutionProvider
  action: string
  arguments: Record<string, unknown>
  approval: ToolRequestApproval
}

export function createToolRequestApproval(
  required: boolean,
  approvalId: string | null = null,
  status: ToolRequestApprovalStatus = required ? 'pending' : 'none',
): ToolRequestApproval {
  return { required, approvalId, status }
}
