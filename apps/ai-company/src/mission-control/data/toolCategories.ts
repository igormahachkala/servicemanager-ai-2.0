export const TOOL_CATEGORIES = [
  'development',
  'infrastructure',
  'communication',
  'business',
  'knowledge',
  'storage',
  'ai',
  'automation',
] as const

export type ToolRegistryCategory = (typeof TOOL_CATEGORIES)[number]

export const TOOL_CATEGORY_META: Record<
  ToolRegistryCategory,
  { icon: string; order: number }
> = {
  development: { icon: '⌨', order: 1 },
  infrastructure: { icon: '⛭', order: 2 },
  communication: { icon: '💬', order: 3 },
  business: { icon: '📊', order: 4 },
  knowledge: { icon: '📚', order: 5 },
  storage: { icon: '🗂', order: 6 },
  ai: { icon: '✦', order: 7 },
  automation: { icon: '⚡', order: 8 },
}
