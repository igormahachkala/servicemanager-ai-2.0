import type { ToolRegistryCategory } from './toolCategories'
import type { ToolRegistryProvider } from './toolProviders'
import type { ToolCapability } from './toolCapabilities'
import type { ToolAccessPolicy } from './toolPolicies'

export type ToolConnectionStatus = 'connected' | 'disconnected' | 'degraded' | 'pending'

export type RegistryTool = {
  id: string
  name: string
  category: ToolRegistryCategory
  provider: ToolRegistryProvider
  capabilities: ToolCapability[]
  permissions: ToolAccessPolicy[]
  connectionStatus: ToolConnectionStatus
  requiresApproval: boolean
  supportsWorkspaceScope: boolean
  supportsAudit: boolean
  descriptionKey: string
}

export const registryTools: RegistryTool[] = [
  {
    id: 'tool-cursor-automation',
    name: 'Cursor Automation',
    category: 'automation',
    provider: 'rest-api',
    capabilities: ['read', 'write', 'execute', 'review', 'create', 'deploy'],
    permissions: ['require-approval', 'workspace-only', 'owner-only'],
    connectionStatus: 'pending',
    requiresApproval: true,
    supportsWorkspaceScope: true,
    supportsAudit: true,
    descriptionKey: 'cursorAutomation',
  },
  {
    id: 'tool-github',
    name: 'GitHub',
    category: 'development',
    provider: 'mcp',
    capabilities: ['read', 'write', 'search', 'review', 'deploy', 'create', 'delete'],
    permissions: ['require-approval', 'workspace-only'],
    connectionStatus: 'connected',
    requiresApproval: true,
    supportsWorkspaceScope: true,
    supportsAudit: true,
    descriptionKey: 'github',
  },
  {
    id: 'tool-docker',
    name: 'Docker',
    category: 'infrastructure',
    provider: 'cli',
    capabilities: ['read', 'execute', 'deploy', 'analyze'],
    permissions: ['require-approval', 'workspace-only'],
    connectionStatus: 'connected',
    requiresApproval: true,
    supportsWorkspaceScope: true,
    supportsAudit: true,
    descriptionKey: 'docker',
  },
  {
    id: 'tool-filesystem',
    name: 'Filesystem',
    category: 'storage',
    provider: 'local',
    capabilities: ['read', 'write', 'search', 'create', 'delete'],
    permissions: ['workspace-only', 'require-approval'],
    connectionStatus: 'connected',
    requiresApproval: false,
    supportsWorkspaceScope: true,
    supportsAudit: true,
    descriptionKey: 'filesystem',
  },
  {
    id: 'tool-browser',
    name: 'Browser',
    category: 'automation',
    provider: 'native',
    capabilities: ['read', 'execute', 'search', 'analyze'],
    permissions: ['require-approval', 'owner-only'],
    connectionStatus: 'pending',
    requiresApproval: true,
    supportsWorkspaceScope: false,
    supportsAudit: true,
    descriptionKey: 'browser',
  },
  {
    id: 'tool-postgresql',
    name: 'PostgreSQL',
    category: 'infrastructure',
    provider: 'cli',
    capabilities: ['read', 'write', 'search', 'execute', 'analyze'],
    permissions: ['workspace-only', 'require-approval'],
    connectionStatus: 'connected',
    requiresApproval: true,
    supportsWorkspaceScope: true,
    supportsAudit: true,
    descriptionKey: 'postgresql',
  },
  {
    id: 'tool-figma',
    name: 'Figma',
    category: 'development',
    provider: 'mcp',
    capabilities: ['read', 'search', 'analyze', 'generate'],
    permissions: ['workspace-only', 'always-allowed'],
    connectionStatus: 'connected',
    requiresApproval: false,
    supportsWorkspaceScope: true,
    supportsAudit: true,
    descriptionKey: 'figma',
  },
  {
    id: 'tool-telegram',
    name: 'Telegram',
    category: 'communication',
    provider: 'rest-api',
    capabilities: ['read', 'write', 'notify'],
    permissions: ['require-approval', 'owner-only'],
    connectionStatus: 'disconnected',
    requiresApproval: true,
    supportsWorkspaceScope: false,
    supportsAudit: true,
    descriptionKey: 'telegram',
  },
  {
    id: 'tool-slack',
    name: 'Slack',
    category: 'communication',
    provider: 'rest-api',
    capabilities: ['read', 'write', 'notify', 'search'],
    permissions: ['require-approval', 'workspace-only'],
    connectionStatus: 'degraded',
    requiresApproval: true,
    supportsWorkspaceScope: true,
    supportsAudit: true,
    descriptionKey: 'slack',
  },
  {
    id: 'tool-email',
    name: 'Email',
    category: 'communication',
    provider: 'rest-api',
    capabilities: ['read', 'write', 'notify', 'search'],
    permissions: ['owner-only', 'require-approval'],
    connectionStatus: 'pending',
    requiresApproval: true,
    supportsWorkspaceScope: false,
    supportsAudit: true,
    descriptionKey: 'email',
  },
  {
    id: 'tool-google-drive',
    name: 'Google Drive',
    category: 'storage',
    provider: 'rest-api',
    capabilities: ['read', 'write', 'search', 'create', 'delete'],
    permissions: ['workspace-only', 'require-approval'],
    connectionStatus: 'connected',
    requiresApproval: true,
    supportsWorkspaceScope: true,
    supportsAudit: true,
    descriptionKey: 'googleDrive',
  },
  {
    id: 'tool-calendar',
    name: 'Calendar',
    category: 'business',
    provider: 'rest-api',
    capabilities: ['read', 'write', 'search', 'create', 'notify'],
    permissions: ['owner-only', 'require-approval'],
    connectionStatus: 'connected',
    requiresApproval: true,
    supportsWorkspaceScope: false,
    supportsAudit: true,
    descriptionKey: 'calendar',
  },
  {
    id: 'tool-n8n',
    name: 'n8n',
    category: 'automation',
    provider: 'rest-api',
    capabilities: ['read', 'write', 'execute', 'deploy', 'notify'],
    permissions: ['workspace-only', 'require-approval'],
    connectionStatus: 'connected',
    requiresApproval: true,
    supportsWorkspaceScope: true,
    supportsAudit: true,
    descriptionKey: 'n8n',
  },
  {
    id: 'tool-ollama',
    name: 'Ollama',
    category: 'ai',
    provider: 'rest-api',
    capabilities: ['read', 'execute', 'generate', 'analyze'],
    permissions: ['workspace-only', 'always-allowed'],
    connectionStatus: 'connected',
    requiresApproval: false,
    supportsWorkspaceScope: true,
    supportsAudit: true,
    descriptionKey: 'ollama',
  },
  {
    id: 'tool-openrouter',
    name: 'OpenRouter',
    category: 'ai',
    provider: 'rest-api',
    capabilities: ['read', 'execute', 'generate', 'analyze'],
    permissions: ['require-approval', 'workspace-only'],
    connectionStatus: 'connected',
    requiresApproval: true,
    supportsWorkspaceScope: true,
    supportsAudit: true,
    descriptionKey: 'openrouter',
  },
  {
    id: 'tool-ssh',
    name: 'SSH',
    category: 'infrastructure',
    provider: 'cli',
    capabilities: ['read', 'execute', 'deploy'],
    permissions: ['owner-only', 'require-approval', 'disabled'],
    connectionStatus: 'disconnected',
    requiresApproval: true,
    supportsWorkspaceScope: true,
    supportsAudit: true,
    descriptionKey: 'ssh',
  },
  {
    id: 'tool-rest',
    name: 'REST',
    category: 'automation',
    provider: 'rest-api',
    capabilities: ['read', 'write', 'execute', 'search', 'create', 'delete'],
    permissions: ['require-approval', 'workspace-only'],
    connectionStatus: 'connected',
    requiresApproval: true,
    supportsWorkspaceScope: true,
    supportsAudit: true,
    descriptionKey: 'rest',
  },
]

export function getRegistryToolById(id: string): RegistryTool | null {
  return registryTools.find((tool) => tool.id === id) ?? null
}

export function getRegistryToolsByCategory(category: ToolRegistryCategory): RegistryTool[] {
  return registryTools.filter((tool) => tool.category === category)
}

export function getRegistryToolsByProvider(provider: ToolRegistryProvider): RegistryTool[] {
  return registryTools.filter((tool) => tool.provider === provider)
}

export function countToolsByConnectionStatus(status: ToolConnectionStatus): number {
  return registryTools.filter((tool) => tool.connectionStatus === status).length
}
