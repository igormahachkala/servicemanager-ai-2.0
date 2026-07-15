/**
 * Employee Connections Center — browser client for trusted secret store (AI-COMPANY-115).
 */

import { redactConnectionSecret } from './employeeConnectionsSecretRedaction'
import type { ConnectionSecretPayload } from './employeeConnectionsTypes'

export const CONNECTIONS_BRIDGE_DEFAULT_HOST = '127.0.0.1'
export const CONNECTIONS_BRIDGE_DEFAULT_PORT = 17321

const ENV = import.meta.env ?? ({} as ImportMetaEnv)

function readEnv(key: string): string | undefined {
  const value = ENV[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function resolveConnectionsBridgeBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/runtime/connections`
  }
  const host = readEnv('VITE_CONNECTIONS_BRIDGE_HOST') ?? CONNECTIONS_BRIDGE_DEFAULT_HOST
  const port = readEnv('VITE_CONNECTIONS_BRIDGE_PORT') ?? String(CONNECTIONS_BRIDGE_DEFAULT_PORT)
  return `http://${host}:${port}`
}

export type ConnectionSecretStoreClient = {
  setSecret: (connectionId: string, payload: ConnectionSecretPayload) => Promise<boolean>
  hasSecret: (connectionId: string) => Promise<boolean>
  rotateSecret: (connectionId: string, payload: ConnectionSecretPayload) => Promise<boolean>
  deleteSecret: (connectionId: string) => Promise<boolean>
  probeBridge: () => Promise<boolean>
}

async function bridgeFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${resolveConnectionsBridgeBaseUrl()}${path}`, init)
}

export function createConnectionSecretStoreClient(): ConnectionSecretStoreClient {
  return {
    async probeBridge() {
      try {
        const response = await bridgeFetch('/v1/health')
        return response.ok
      } catch {
        return false
      }
    },

    async setSecret(connectionId, payload) {
      try {
        const response = await bridgeFetch('/v1/secrets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionId, payload, action: 'set' }),
        })
        return response.ok
      } catch {
        return false
      }
    },

    async hasSecret(connectionId) {
      try {
        const response = await bridgeFetch(`/v1/secrets/${encodeURIComponent(connectionId)}`)
        if (!response.ok) return false
        const body = (await response.json()) as { hasSecret?: boolean }
        return body.hasSecret === true
      } catch {
        return false
      }
    },

    async rotateSecret(connectionId, payload) {
      try {
        const response = await bridgeFetch('/v1/secrets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionId, payload, action: 'rotate' }),
        })
        return response.ok
      } catch {
        return false
      }
    },

    async deleteSecret(connectionId) {
      try {
        const response = await bridgeFetch(`/v1/secrets/${encodeURIComponent(connectionId)}`, {
          method: 'DELETE',
        })
        return response.ok
      } catch {
        return false
      }
    },
  }
}

export async function testConnectionViaBridge(input: {
  connectionId: string
  providerId: string
  authMethod: string
  environment: string
  configuration: Record<string, unknown>
}): Promise<{
  success: boolean
  status: string
  health: string
  checkedAt: string
  latencyMs: number | null
  reasonCode: string
  message: string
  availableCapabilities: string[]
} | null> {
  try {
    const response = await bridgeFetch('/v1/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!response.ok) {
      const text = await response.text()
      return {
        success: false,
        status: 'ERROR',
        health: 'UNAVAILABLE',
        checkedAt: new Date().toISOString(),
        latencyMs: null,
        reasonCode: 'BRIDGE_ERROR',
        message: redactConnectionSecret(text),
        availableCapabilities: [],
      }
    }
    return (await response.json()) as Awaited<ReturnType<typeof testConnectionViaBridge>>
  } catch (error) {
    return {
      success: false,
      status: 'ERROR',
      health: 'UNAVAILABLE',
      checkedAt: new Date().toISOString(),
      latencyMs: null,
      reasonCode: 'BRIDGE_OFFLINE',
      message: redactConnectionSecret(
        error instanceof Error ? error.message : 'Connections bridge offline.',
      ),
      availableCapabilities: [],
    }
  }
}

export async function detectOllamaEndpointViaBridge(): Promise<{
  detected: boolean
  endpoint: string | null
  models: string[]
}> {
  try {
    const response = await bridgeFetch('/v1/detect/ollama')
    if (!response.ok) return { detected: false, endpoint: null, models: [] }
    return (await response.json()) as { detected: boolean; endpoint: string | null; models: string[] }
  } catch {
    return { detected: false, endpoint: null, models: [] }
  }
}
