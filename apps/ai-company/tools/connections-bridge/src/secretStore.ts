/**
 * Connections Bridge — in-memory secret store (AI-COMPANY-115).
 * DEV V1: secrets persist until bridge restart — never browser localStorage.
 */

import type { ConnectionSecretPayload } from '../../../src/domain/employeeConnections/employeeConnectionsTypes.ts'

type StoredSecret = {
  payload: ConnectionSecretPayload
  updatedAt: string
}

const secrets = new Map<string, StoredSecret>()

export type ConnectionSecretStore = {
  setSecret: (connectionId: string, payload: ConnectionSecretPayload) => void
  hasSecret: (connectionId: string) => boolean
  getSecretForRuntime: (connectionId: string) => ConnectionSecretPayload | null
  rotateSecret: (connectionId: string, payload: ConnectionSecretPayload) => void
  deleteSecret: (connectionId: string) => void
}

export function createInMemoryConnectionSecretStore(): ConnectionSecretStore {
  return {
    setSecret(connectionId, payload) {
      secrets.set(connectionId, { payload, updatedAt: new Date().toISOString() })
    },
    hasSecret(connectionId) {
      return secrets.has(connectionId)
    },
    getSecretForRuntime(connectionId) {
      return secrets.get(connectionId)?.payload ?? null
    },
    rotateSecret(connectionId, payload) {
      secrets.set(connectionId, { payload, updatedAt: new Date().toISOString() })
    },
    deleteSecret(connectionId) {
      secrets.delete(connectionId)
    },
  }
}

export const connectionSecretStore = createInMemoryConnectionSecretStore()
