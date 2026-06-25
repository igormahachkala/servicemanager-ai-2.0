export const TOOL_PROVIDERS = ['mcp', 'rest-api', 'cli', 'native', 'local'] as const

export type ToolRegistryProvider = (typeof TOOL_PROVIDERS)[number]

export const TOOL_PROVIDER_META: Record<
  ToolRegistryProvider,
  { descriptionKey: string; order: number }
> = {
  mcp: { descriptionKey: 'mcp', order: 1 },
  'rest-api': { descriptionKey: 'restApi', order: 2 },
  cli: { descriptionKey: 'cli', order: 3 },
  native: { descriptionKey: 'native', order: 4 },
  local: { descriptionKey: 'local', order: 5 },
}
