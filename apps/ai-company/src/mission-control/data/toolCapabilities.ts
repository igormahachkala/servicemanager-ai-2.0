export const TOOL_CAPABILITIES = [
  'read',
  'write',
  'execute',
  'search',
  'create',
  'delete',
  'deploy',
  'review',
  'analyze',
  'generate',
  'notify',
] as const

export type ToolCapability = (typeof TOOL_CAPABILITIES)[number]

export const CAPABILITY_GROUPS: Record<string, ToolCapability[]> = {
  data: ['read', 'write', 'search', 'create', 'delete'],
  execution: ['execute', 'deploy', 'review', 'analyze', 'generate'],
  messaging: ['notify'],
}
