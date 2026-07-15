/**
 * Employee Connections Center — provider catalog V1 (AI-COMPANY-115).
 */

import type {
  ConnectionCapabilityDefinition,
  ConnectionProviderDefinition,
} from './employeeConnectionsTypes'

function cap(
  id: string,
  label: string,
  description: string,
  permissionLevel: ConnectionCapabilityDefinition['permissionLevel'] = 'READ_ONLY',
  defaultEnabled = false,
): ConnectionCapabilityDefinition {
  return { id, label, description, permissionLevel, defaultEnabled }
}

const GITHUB_CAPABILITIES: ConnectionCapabilityDefinition[] = [
  cap('github.repository.read', 'Read repository', 'Read repository metadata and files', 'READ_ONLY', true),
  cap('github.branch.create', 'Create branch', 'Create execution branches', 'READ_WRITE'),
  cap('github.commit.create', 'Create commit', 'Create commits on branches', 'READ_WRITE'),
  cap('github.push', 'Push', 'Push commits to remote', 'READ_WRITE'),
  cap('github.pull_request.read', 'Read pull requests', 'Read PR metadata', 'READ_ONLY', true),
  cap('github.pull_request.create', 'Create pull request', 'Open draft PRs', 'READ_WRITE'),
  cap('github.pull_request.review', 'Review pull request', 'Review PR diffs', 'READ_ONLY'),
  cap('github.pull_request.merge', 'Merge pull request', 'Merge PRs — disabled by default', 'ADMIN'),
]

const CURSOR_CAPABILITIES: ConnectionCapabilityDefinition[] = [
  cap('cursor.automation.dispatch', 'Dispatch automation', 'Send Cursor Automation webhook tasks', 'EXECUTE', true),
  cap('cursor.automation.status.read', 'Read automation status', 'Read dispatch correlation', 'READ_ONLY', true),
  cap('cursor.automation.result.reconcile', 'Reconcile result', 'Discover automation results via GitHub evidence', 'READ_ONLY', true),
]

const OLLAMA_CAPABILITIES: ConnectionCapabilityDefinition[] = [
  cap('ollama.model.list', 'List models', 'List available local models', 'READ_ONLY', true),
  cap('ollama.inference.run', 'Run inference', 'Execute local inference', 'EXECUTE', true),
]

const GMAIL_CAPABILITIES: ConnectionCapabilityDefinition[] = [
  cap('gmail.message.read', 'Read messages', 'Read email messages', 'READ_ONLY'),
  cap('gmail.message.search', 'Search messages', 'Search mailbox', 'READ_ONLY'),
  cap('gmail.draft.create', 'Create draft', 'Create email drafts', 'READ_WRITE'),
  cap('gmail.message.send', 'Send message', 'Send email after approval', 'EXECUTE'),
]

const CALENDAR_CAPABILITIES: ConnectionCapabilityDefinition[] = [
  cap('calendar.event.read', 'Read events', 'Read calendar events', 'READ_ONLY'),
  cap('calendar.event.create', 'Create event', 'Create calendar events', 'READ_WRITE'),
  cap('calendar.event.update', 'Update event', 'Update calendar events', 'READ_WRITE'),
  cap('calendar.event.delete', 'Delete event', 'Delete calendar events', 'ADMIN'),
]

const DRIVE_CAPABILITIES: ConnectionCapabilityDefinition[] = [
  cap('drive.file.search', 'Search files', 'Search Drive files', 'READ_ONLY'),
  cap('drive.file.read', 'Read files', 'Read Drive documents', 'READ_ONLY'),
  cap('drive.file.create', 'Create files', 'Create Drive files', 'READ_WRITE'),
  cap('drive.file.update', 'Update files', 'Update Drive files', 'READ_WRITE'),
]

const FIGMA_CAPABILITIES: ConnectionCapabilityDefinition[] = [
  cap('figma.file.read', 'Read files', 'Read Figma files', 'READ_ONLY'),
  cap('figma.design.create', 'Create design', 'Create design nodes', 'READ_WRITE'),
  cap('figma.design.update', 'Update design', 'Update design nodes', 'READ_WRITE'),
]

const N8N_CAPABILITIES: ConnectionCapabilityDefinition[] = [
  cap('n8n.workflow.read', 'Read workflows', 'Read n8n workflows', 'READ_ONLY'),
  cap('n8n.workflow.execute', 'Execute workflow', 'Trigger n8n workflows', 'EXECUTE'),
]

const SMA_CAPABILITIES: ConnectionCapabilityDefinition[] = [
  cap('servicemanager.ticket.read', 'Read tickets', 'Read ServiceManager tickets', 'READ_ONLY'),
  cap('servicemanager.ticket.create', 'Create ticket', 'Create tickets', 'READ_WRITE'),
  cap('servicemanager.ticket.update', 'Update ticket', 'Update tickets', 'READ_WRITE'),
  cap('servicemanager.analytics.read', 'Read analytics', 'Read analytics dashboards', 'READ_ONLY'),
]

const MAX_CAPABILITIES: ConnectionCapabilityDefinition[] = [
  cap('max.message.read', 'Read messages', 'Read MAX messages', 'READ_ONLY'),
  cap('max.message.send', 'Send message', 'Send MAX messages', 'EXECUTE'),
  cap('max.notification.send', 'Send notification', 'Send MAX notifications', 'EXECUTE'),
]

export const CONNECTION_PROVIDER_CATALOG: ConnectionProviderDefinition[] = [
  {
    id: 'github',
    name: 'GitHub',
    description: 'Repository access, branches, commits, and pull requests.',
    iconKey: 'github',
    category: 'DEVELOPMENT',
    authMethods: ['LOCAL_SESSION', 'PERSONAL_ACCESS_TOKEN', 'OAUTH'],
    supportedCapabilities: GITHUB_CAPABILITIES,
    environments: ['DEV', 'STAGE', 'PRODUCTION'],
    costModel: 'INCLUDED_IN_SUBSCRIPTION',
    connectionMode: 'HYBRID',
    documentationUrl: 'https://docs.github.com',
    enabled: true,
    implemented: true,
  },
  {
    id: 'cursor-automations',
    name: 'Cursor Automations',
    description: 'Webhook-based Cursor Automation dispatch and result reconciliation.',
    iconKey: 'cursor',
    category: 'AUTOMATION',
    authMethods: ['WEBHOOK_SECRET'],
    supportedCapabilities: CURSOR_CAPABILITIES,
    environments: ['DEV'],
    costModel: 'INCLUDED_IN_SUBSCRIPTION',
    connectionMode: 'CLOUD',
    enabled: true,
    implemented: true,
  },
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Local model runtime for reasoning and inference.',
    iconKey: 'ollama',
    category: 'AI_MODELS',
    authMethods: ['LOCAL_RUNTIME', 'ENDPOINT_ONLY'],
    supportedCapabilities: OLLAMA_CAPABILITIES,
    environments: ['DEV', 'STAGE'],
    costModel: 'FREE',
    connectionMode: 'LOCAL',
    enabled: true,
    implemented: true,
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Email read, search, drafts, and send with approval.',
    iconKey: 'gmail',
    category: 'COMMUNICATION',
    authMethods: ['OAUTH'],
    supportedCapabilities: GMAIL_CAPABILITIES,
    environments: ['DEV', 'STAGE', 'PRODUCTION'],
    costModel: 'INCLUDED_IN_SUBSCRIPTION',
    connectionMode: 'CLOUD',
    enabled: true,
    implemented: false,
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Calendar events read and write.',
    iconKey: 'google-calendar',
    category: 'CALENDAR',
    authMethods: ['OAUTH'],
    supportedCapabilities: CALENDAR_CAPABILITIES,
    environments: ['DEV', 'STAGE', 'PRODUCTION'],
    costModel: 'INCLUDED_IN_SUBSCRIPTION',
    connectionMode: 'CLOUD',
    enabled: true,
    implemented: false,
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Document search and file access.',
    iconKey: 'google-drive',
    category: 'DOCUMENTS',
    authMethods: ['OAUTH'],
    supportedCapabilities: DRIVE_CAPABILITIES,
    environments: ['DEV', 'STAGE', 'PRODUCTION'],
    costModel: 'INCLUDED_IN_SUBSCRIPTION',
    connectionMode: 'CLOUD',
    enabled: true,
    implemented: false,
  },
  {
    id: 'figma',
    name: 'Figma',
    description: 'Design file access and updates.',
    iconKey: 'figma',
    category: 'DESIGN',
    authMethods: ['OAUTH', 'PERSONAL_ACCESS_TOKEN'],
    supportedCapabilities: FIGMA_CAPABILITIES,
    environments: ['DEV', 'STAGE', 'PRODUCTION'],
    costModel: 'INCLUDED_IN_SUBSCRIPTION',
    connectionMode: 'CLOUD',
    enabled: true,
    implemented: false,
  },
  {
    id: 'n8n',
    name: 'n8n',
    description: 'Workflow automation execution.',
    iconKey: 'n8n',
    category: 'AUTOMATION',
    authMethods: ['API_KEY', 'BEARER_TOKEN'],
    supportedCapabilities: N8N_CAPABILITIES,
    environments: ['DEV', 'STAGE'],
    costModel: 'USAGE_BASED',
    connectionMode: 'HYBRID',
    enabled: true,
    implemented: false,
  },
  {
    id: 'servicemanager-ai',
    name: 'ServiceManager.AI',
    description: 'Corporate ticket and analytics access.',
    iconKey: 'servicemanager',
    category: 'CORPORATE_SYSTEMS',
    authMethods: ['API_KEY', 'BEARER_TOKEN'],
    supportedCapabilities: SMA_CAPABILITIES,
    environments: ['DEV', 'STAGE', 'PRODUCTION'],
    costModel: 'INCLUDED_IN_SUBSCRIPTION',
    connectionMode: 'CLOUD',
    enabled: true,
    implemented: false,
  },
  {
    id: 'max-messenger',
    name: 'MAX Messenger',
    description: 'MAX messaging and notifications.',
    iconKey: 'max',
    category: 'MESSAGING',
    authMethods: ['API_KEY', 'BEARER_TOKEN'],
    supportedCapabilities: MAX_CAPABILITIES,
    environments: ['DEV', 'STAGE', 'PRODUCTION'],
    costModel: 'INCLUDED_IN_SUBSCRIPTION',
    connectionMode: 'CLOUD',
    enabled: true,
    implemented: false,
  },
]

export function getConnectionProvider(providerId: string): ConnectionProviderDefinition | null {
  return CONNECTION_PROVIDER_CATALOG.find((provider) => provider.id === providerId) ?? null
}

export function listConnectionProviders(): ConnectionProviderDefinition[] {
  return CONNECTION_PROVIDER_CATALOG.filter((provider) => provider.enabled)
}

export function isProviderCapabilitySupported(providerId: string, capabilityId: string): boolean {
  const provider = getConnectionProvider(providerId)
  if (!provider) return false
  return provider.supportedCapabilities.some((capability) => capability.id === capabilityId)
}

export function getDefaultCapabilitiesForEmployee(
  employeeId: string,
  providerId: string,
): string[] {
  const provider = getConnectionProvider(providerId)
  if (!provider) return []

  const defaults: Record<string, Record<string, string[]>> = {
    'ag-builder': {
      github: [
        'github.repository.read',
        'github.branch.create',
        'github.commit.create',
        'github.push',
        'github.pull_request.create',
      ],
      'cursor-automations': [
        'cursor.automation.dispatch',
        'cursor.automation.result.reconcile',
      ],
      ollama: ['ollama.model.list', 'ollama.inference.run'],
    },
    max: {
      gmail: ['gmail.message.search', 'gmail.message.read', 'gmail.draft.create', 'gmail.message.send'],
      'google-calendar': ['calendar.event.read', 'calendar.event.create'],
      github: ['github.repository.read', 'github.pull_request.read'],
    },
    atlas: {
      'google-drive': ['drive.file.search', 'drive.file.read'],
      github: ['github.repository.read'],
      ollama: ['ollama.inference.run'],
    },
    sentinel: {
      github: ['github.repository.read', 'github.pull_request.review'],
    },
  }

  return defaults[employeeId]?.[providerId] ?? provider.supportedCapabilities.filter((c) => c.defaultEnabled).map((c) => c.id)
}
