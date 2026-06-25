import { useMemo } from 'react'
import { TOOL_CATEGORIES } from '../data/toolCategories'
import { TOOL_PROVIDERS } from '../data/toolProviders'
import {
  countToolsByConnectionStatus,
  getRegistryToolById,
  getRegistryToolsByCategory,
  getRegistryToolsByProvider,
  registryTools,
  type RegistryTool,
  type ToolConnectionStatus,
} from '../data/tools'
import type { ToolRegistryCategory } from '../data/toolCategories'
import type { ToolRegistryProvider } from '../data/toolProviders'

export function useTools() {
  const tools = registryTools

  const byCategory = useMemo(() => {
    const map = {} as Record<ToolRegistryCategory, RegistryTool[]>
    for (const category of TOOL_CATEGORIES) {
      map[category] = getRegistryToolsByCategory(category)
    }
    return map
  }, [])

  const byProvider = useMemo(() => {
    const map = {} as Record<ToolRegistryProvider, RegistryTool[]>
    for (const provider of TOOL_PROVIDERS) {
      map[provider] = getRegistryToolsByProvider(provider)
    }
    return map
  }, [])

  const stats = useMemo(
    () => ({
      total: tools.length,
      connected: countToolsByConnectionStatus('connected'),
      degraded: countToolsByConnectionStatus('degraded'),
      disconnected: countToolsByConnectionStatus('disconnected'),
      pending: countToolsByConnectionStatus('pending'),
      categories: TOOL_CATEGORIES.length,
      providers: TOOL_PROVIDERS.length,
    }),
    [tools.length],
  )

  const getById = (id: string): RegistryTool | null => getRegistryToolById(id)

  const filterTools = (query: {
    category?: ToolRegistryCategory | 'all'
    provider?: ToolRegistryProvider | 'all'
    status?: ToolConnectionStatus | 'all'
  }): RegistryTool[] => {
    return tools.filter((tool) => {
      if (query.category && query.category !== 'all' && tool.category !== query.category) return false
      if (query.provider && query.provider !== 'all' && tool.provider !== query.provider) return false
      if (query.status && query.status !== 'all' && tool.connectionStatus !== query.status) return false
      return true
    })
  }

  return { tools, byCategory, byProvider, stats, getById, filterTools }
}
