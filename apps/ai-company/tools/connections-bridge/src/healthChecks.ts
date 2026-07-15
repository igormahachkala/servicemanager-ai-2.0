/**
 * Connections Bridge — health checks (AI-COMPANY-115).
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { connectionSecretStore } from './secretStore.ts'
import type { ConnectionsBridgeConfig } from './config.ts'

const execFileAsync = promisify(execFile)

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

async function checkOllama(configuration: Record<string, unknown>) {
  const endpoint =
    (typeof configuration.endpoint === 'string' && configuration.endpoint.trim()) ||
    'http://127.0.0.1:11434'
  const started = Date.now()
  try {
    const response = await fetch(`${endpoint.replace(/\/$/, '')}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
    const latencyMs = Date.now() - started
    if (!response.ok) {
      return {
        success: false,
        status: 'ERROR',
        health: 'UNAVAILABLE',
        checkedAt: new Date().toISOString(),
        latencyMs,
        reasonCode: 'OLLAMA_UNAVAILABLE',
        message: `Ollama endpoint returned ${response.status}.`,
        availableCapabilities: [],
      }
    }
    const body = (await response.json()) as { models?: Array<{ name?: string }> }
    const models = (body.models ?? [])
      .map((model) => model.name)
      .filter((name): name is string => typeof name === 'string')
    return {
      success: true,
      status: 'CONNECTED',
      health: 'HEALTHY',
      checkedAt: new Date().toISOString(),
      latencyMs,
      reasonCode: 'OLLAMA_HEALTHY',
      message: models.length ? `Found ${models.length} models.` : 'Endpoint reachable.',
      availableCapabilities: ['ollama.model.list', ...(models.length ? ['ollama.inference.run'] : [])],
    }
  } catch (error) {
    return {
      success: false,
      status: 'ERROR',
      health: 'UNAVAILABLE',
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
      reasonCode: 'OLLAMA_UNAVAILABLE',
      message: error instanceof Error ? error.message : 'Ollama unreachable.',
      availableCapabilities: [],
    }
  }
}

async function checkCursor(connectionId: string, configuration: Record<string, unknown>) {
  const webhookUrl = typeof configuration.webhookUrl === 'string' ? configuration.webhookUrl.trim() : ''
  if (!webhookUrl || !isValidHttpUrl(webhookUrl)) {
    return {
      success: false,
      status: 'NOT_CONFIGURED',
      health: 'UNAVAILABLE',
      checkedAt: new Date().toISOString(),
      latencyMs: null,
      reasonCode: 'CURSOR_WEBHOOK_INVALID',
      message: 'Webhook URL is missing or invalid.',
      availableCapabilities: [],
    }
  }
  if (!connectionSecretStore.hasSecret(connectionId)) {
    return {
      success: false,
      status: 'AUTH_REQUIRED',
      health: 'UNAVAILABLE',
      checkedAt: new Date().toISOString(),
      latencyMs: null,
      reasonCode: 'CURSOR_SECRET_MISSING',
      message: 'Bearer key is not stored in trusted runtime.',
      availableCapabilities: [],
    }
  }
  return {
    success: true,
    status: 'CONFIGURED',
    health: 'HEALTHY',
    checkedAt: new Date().toISOString(),
    latencyMs: null,
    reasonCode: 'CURSOR_CONFIGURED',
    message: 'Webhook URL and secret are configured. Dispatch requires explicit Owner action.',
    availableCapabilities: [
      'cursor.automation.dispatch',
      'cursor.automation.status.read',
      'cursor.automation.result.reconcile',
    ],
  }
}

async function checkGitHubLocal(config: ConnectionsBridgeConfig, configuration: Record<string, unknown>) {
  const repository =
    typeof configuration.repository === 'string'
      ? configuration.repository
      : typeof configuration.repositoryOwner === 'string' && typeof configuration.repositoryName === 'string'
        ? `${configuration.repositoryOwner}/${configuration.repositoryName}`
        : null

  if (!repository) {
    return {
      success: false,
      status: 'NOT_CONFIGURED',
      health: 'UNAVAILABLE',
      checkedAt: new Date().toISOString(),
      latencyMs: null,
      reasonCode: 'GITHUB_REPOSITORY_MISSING',
      message: 'Repository is not configured.',
      availableCapabilities: [],
    }
  }

  const started = Date.now()
  try {
    const remote = await execFileAsync('git', ['remote', 'get-url', 'origin'], {
      cwd: config.repositoryRoot,
      timeout: 10_000,
    })
    const remoteText = remote.stdout.trim().toLowerCase()
    const [owner, name] = repository.toLowerCase().split('/')
    const matches =
      remoteText.includes(`${owner}/${name}`) || remoteText.includes(`${owner}.${name}`)
    if (!matches) {
      return {
        success: false,
        status: 'ERROR',
        health: 'UNAVAILABLE',
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
        reasonCode: 'GITHUB_REPOSITORY_MISMATCH',
        message: 'Local repository origin does not match configured repository.',
        availableCapabilities: [],
      }
    }

    await execFileAsync('git', ['branch', '-r'], { cwd: config.repositoryRoot, timeout: 10_000 })

    return {
      success: true,
      status: 'CONNECTED',
      health: 'HEALTHY',
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
      reasonCode: 'GITHUB_LOCAL_HEALTHY',
      message: 'Local git origin and branch listing verified.',
      availableCapabilities: [
        'github.repository.read',
        'github.branch.create',
        'github.commit.create',
        'github.push',
        'github.pull_request.read',
        'github.pull_request.create',
      ],
    }
  } catch (error) {
    return {
      success: false,
      status: 'ERROR',
      health: 'UNAVAILABLE',
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
      reasonCode: 'GITHUB_LOCAL_ERROR',
      message: error instanceof Error ? error.message : 'Git local check failed.',
      availableCapabilities: [],
    }
  }
}

export async function runConnectionHealthCheck(input: {
  connectionId: string
  providerId: string
  configuration: Record<string, unknown>
  config: ConnectionsBridgeConfig
}) {
  switch (input.providerId) {
    case 'ollama':
      return checkOllama(input.configuration)
    case 'cursor-automations':
      return checkCursor(input.connectionId, input.configuration)
    case 'github':
      return checkGitHubLocal(input.config, input.configuration)
    default:
      return {
        success: false,
        status: 'AUTH_REQUIRED',
        health: 'UNAVAILABLE',
        checkedAt: new Date().toISOString(),
        latencyMs: null,
        reasonCode: 'PROVIDER_NOT_IMPLEMENTED',
        message: 'Provider health check is not implemented in V1.',
        availableCapabilities: [],
      }
  }
}

export async function detectOllamaEndpoint() {
  const endpoint = 'http://127.0.0.1:11434'
  try {
    const response = await fetch(`${endpoint}/api/tags`, { signal: AbortSignal.timeout(3000) })
    if (!response.ok) return { detected: false, endpoint: null, models: [] as string[] }
    const body = (await response.json()) as { models?: Array<{ name?: string }> }
    const models = (body.models ?? [])
      .map((model) => model.name)
      .filter((name): name is string => typeof name === 'string')
    return { detected: true, endpoint, models }
  } catch {
    return { detected: false, endpoint: null, models: [] as string[] }
  }
}
