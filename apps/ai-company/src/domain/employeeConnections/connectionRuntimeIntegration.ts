/**
 * Employee Connections Center — runtime integration helpers (AI-COMPANY-115).
 */

import { resolveCursorAutomationWebhookConfig } from '../cursorAutomationRunner/cursorAutomationWebhookConfig'
import type { CursorAutomationWebhookConfig } from '../cursorAutomationRunner/cursorAutomationRunnerTypes'
import { getEffectiveOllamaBaseUrl, loadOllamaSettings } from '../runtime/providers/runtimeHealth'
import type { OllamaSettings } from '../runtime/providers/runtimeHealth'
import { findConnectionGrantForCapability, resolveEmployeeCapability } from './resolveEmployeeCapability'
import { getCompanyConnection, loadEmployeeConnectionsStore } from './employeeConnectionsStorage'

export type ResolvedCursorAutomationConnection = {
  source: 'connection' | 'legacy_env'
  connectionId: string | null
  webhookUrl: string | null
  apiKey: string | null
  repositoryOwner: string | null
  repositoryName: string | null
  baseBranch: string | null
  branchPrefix: string | null
}

export type ResolvedOllamaConnection = {
  source: 'connection' | 'legacy_settings'
  connectionId: string | null
  endpoint: string
  defaultModel: string | null
  allowedModels: string[]
}

function readConfigString(configuration: Record<string, unknown>, key: string): string | null {
  const value = configuration[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function resolveCursorAutomationConnectionForEmployee(
  employeeId: string,
): ResolvedCursorAutomationConnection {
  const resolution = resolveEmployeeCapability({
    employeeId,
    capabilityId: 'cursor.automation.dispatch',
    environment: 'DEV',
    ownerApproved: true,
  })

  if (resolution.allowed && resolution.connectionId) {
    const connection = getCompanyConnection(resolution.connectionId)
    if (connection) {
      const config = connection.configuration
      return {
        source: 'connection',
        connectionId: connection.id,
        webhookUrl: readConfigString(config, 'webhookUrl'),
        apiKey: null,
        repositoryOwner: readConfigString(config, 'repositoryOwner'),
        repositoryName: readConfigString(config, 'repositoryName'),
        baseBranch: readConfigString(config, 'baseBranch'),
        branchPrefix: readConfigString(config, 'branchPrefix'),
      }
    }
  }

  const legacy = resolveCursorAutomationWebhookConfig()
  return {
    source: 'legacy_env',
    connectionId: null,
    webhookUrl: legacy.url,
    apiKey: legacy.apiKey,
    repositoryOwner: null,
    repositoryName: null,
    baseBranch: 'main',
    branchPrefix: 'cursor/',
  }
}

export function resolveCursorAutomationWebhookConfigFromConnections(
  employeeId: string,
  override?: Partial<Pick<CursorAutomationWebhookConfig, 'url' | 'apiKey'>>,
): CursorAutomationWebhookConfig {
  const resolved = resolveCursorAutomationConnectionForEmployee(employeeId)
  const legacy = resolveCursorAutomationWebhookConfig(override)

  if (resolved.source === 'connection' && resolved.webhookUrl) {
    return {
      url: override?.url ?? resolved.webhookUrl,
      apiKey: override?.apiKey ?? legacy.apiKey,
      configKeys: legacy.configKeys,
    }
  }

  return legacy
}

export function resolveOllamaConnectionForEmployee(employeeId: string): ResolvedOllamaConnection {
  const resolution = resolveEmployeeCapability({
    employeeId,
    capabilityId: 'ollama.inference.run',
    environment: 'DEV',
    ownerApproved: true,
  })

  if (resolution.allowed && resolution.connectionId) {
    const connection = getCompanyConnection(resolution.connectionId)
    if (connection) {
      const endpoint = readConfigString(connection.configuration, 'endpoint') ?? 'http://127.0.0.1:11434'
      const defaultModel = readConfigString(connection.configuration, 'defaultModel')
      const allowedModelsRaw = connection.configuration.allowedModels
      const allowedModels = Array.isArray(allowedModelsRaw)
        ? allowedModelsRaw.filter((item): item is string => typeof item === 'string')
        : defaultModel
          ? [defaultModel]
          : []
      return {
        source: 'connection',
        connectionId: connection.id,
        endpoint,
        defaultModel,
        allowedModels,
      }
    }
  }

  const settings: OllamaSettings = loadOllamaSettings()
  return {
    source: 'legacy_settings',
    connectionId: null,
    endpoint: getEffectiveOllamaBaseUrl(settings),
    defaultModel: settings.defaultModelTag,
    allowedModels: settings.defaultModelTag ? [settings.defaultModelTag] : [],
  }
}

export function resolveGitHubConnectionForEmployee(employeeId: string): {
  source: 'connection' | 'none'
  connectionId: string | null
  repository: string | null
  mode: string | null
} {
  const { connection } = findConnectionGrantForCapability(
    employeeId,
    'github.repository.read',
    'DEV',
    loadEmployeeConnectionsStore(),
  )
  if (!connection) {
    return { source: 'none', connectionId: null, repository: null, mode: null }
  }
  const owner = readConfigString(connection.configuration, 'repositoryOwner')
  const name = readConfigString(connection.configuration, 'repositoryName')
  const repository = owner && name ? `${owner}/${name}` : readConfigString(connection.configuration, 'repository')
  return {
    source: 'connection',
    connectionId: connection.id,
    repository,
    mode: readConfigString(connection.configuration, 'mode'),
  }
}

export function preflightEmployeeCapability(input: {
  employeeId: string
  capabilityId: string
  environment?: 'DEV' | 'STAGE' | 'PRODUCTION'
  ownerApproved?: boolean
}) {
  return resolveEmployeeCapability({
    employeeId: input.employeeId,
    capabilityId: input.capabilityId,
    environment: input.environment ?? 'DEV',
    ownerApproved: input.ownerApproved,
  })
}
