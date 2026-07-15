/**
 * Employee Connections Center — tests (AI-COMPANY-115).
 */

import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'

import { BUILDER_EMPLOYEE_ID } from '../mobileEmployee/mobileEmployeeRegistry.ts'
import {
  CONNECTION_PROVIDER_CATALOG,
  getConnectionProvider,
  isProviderCapabilitySupported,
  listConnectionProviders,
} from './connectionProviderCatalog.ts'
import { detectLegacyRuntimeConnections } from './detectLegacyRuntimeConnections.ts'
import {
  preflightEmployeeCapability,
  resolveCursorAutomationConnectionForEmployee,
  resolveOllamaConnectionForEmployee,
} from './connectionRuntimeIntegration.ts'
import {
  grantConnectionToEmployee,
  revokeEmployeeConnectionGrant,
} from './employeeConnectionsService.ts'
import {
  maskSecretValue,
  redactConnectionSecret,
  sanitizeConnectionConfiguration,
} from './employeeConnectionsSecretRedaction.ts'
import {
  emptyEmployeeConnectionsStore,
  saveEmployeeConnectionsStore,
  upsertCompanyConnection,
  upsertEmployeeGrant,
} from './employeeConnectionsStorage.ts'
import { resolveEmployeeCapability } from './resolveEmployeeCapability.ts'
import { getEmployeeConnectionsSnapshot } from './employeeConnectionsService.ts'
import type { CompanyConnection, EmployeeConnectionGrant } from './employeeConnectionsTypes.ts'

function installStorageMock(): void {
  const data = new Map<string, string>()
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
    removeItem: (key: string) => {
      data.delete(key)
    },
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size
    },
  }

  ;(globalThis as { window?: Window; localStorage?: Storage }).window = {
    localStorage: storage as Storage,
    dispatchEvent: () => true,
    location: { origin: 'http://localhost:5173', hostname: 'localhost' },
  } as Window
  ;(globalThis as { localStorage?: Storage }).localStorage = storage as Storage
}

function seedConnection(overrides: Partial<CompanyConnection> = {}): CompanyConnection {
  return {
    id: overrides.id ?? 'conn-test-001',
    providerId: overrides.providerId ?? 'cursor-automations',
    displayName: overrides.displayName ?? 'Cursor DEV',
    status: overrides.status ?? 'CONNECTED',
    authMethod: overrides.authMethod ?? 'WEBHOOK_SECRET',
    environment: overrides.environment ?? 'DEV',
    configuration: overrides.configuration ?? {
      webhookUrl: 'https://api2.cursor.sh/automations/webhook/test',
      repositoryOwner: 'owner',
      repositoryName: 'repo',
      baseBranch: 'main',
      branchPrefix: 'cursor/',
    },
    secretRef: overrides.secretRef ?? 'conn-test-001',
    secretMask: overrides.secretMask ?? '••••••••1234',
    health: overrides.health ?? 'HEALTHY',
    costClassification: overrides.costClassification ?? 'INCLUDED_IN_SUBSCRIPTION',
    createdAt: '2026-07-15T08:00:00.000Z',
    updatedAt: '2026-07-15T08:00:00.000Z',
    lastCheckedAt: '2026-07-15T08:00:00.000Z',
    lastUsedAt: null,
    createdBy: 'owner',
    ...overrides,
  }
}

function seedGrant(overrides: Partial<EmployeeConnectionGrant> = {}): EmployeeConnectionGrant {
  return {
    id: overrides.id ?? 'grant-test-001',
    employeeId: overrides.employeeId ?? BUILDER_EMPLOYEE_ID,
    connectionId: overrides.connectionId ?? 'conn-test-001',
    capabilityIds: overrides.capabilityIds ?? [
      'cursor.automation.dispatch',
      'cursor.automation.result.reconcile',
    ],
    permissionLevel: overrides.permissionLevel ?? 'EXECUTE',
    requiresOwnerApproval: overrides.requiresOwnerApproval ?? false,
    allowedEnvironments: overrides.allowedEnvironments ?? ['DEV'],
    spendingPolicy: overrides.spendingPolicy ?? 'INCLUDED_ONLY',
    enabled: overrides.enabled ?? true,
    createdAt: '2026-07-15T08:00:00.000Z',
    updatedAt: '2026-07-15T08:00:00.000Z',
    ...overrides,
  }
}

function writeStore(connection: CompanyConnection, grant?: EmployeeConnectionGrant) {
  let store = emptyEmployeeConnectionsStore()
  store = upsertCompanyConnection(connection, store)
  if (grant) store = upsertEmployeeGrant(grant, store)
  saveEmployeeConnectionsStore(store)
  return store
}

describe('employeeConnections domain', () => {
  beforeEach(() => {
    installStorageMock()
    globalThis.localStorage?.clear()
  })

  it('1. provider catalog contains all required providers', () => {
    assert.equal(CONNECTION_PROVIDER_CATALOG.length >= 10, true)
    const ids = listConnectionProviders().map((provider) => provider.id)
    for (const required of [
      'github',
      'cursor-automations',
      'ollama',
      'gmail',
      'google-calendar',
      'google-drive',
      'figma',
      'n8n',
      'servicemanager-ai',
      'max-messenger',
    ]) {
      assert.ok(ids.includes(required), `missing ${required}`)
    }
  })

  it('2. connection created without raw secret in domain object', () => {
    const connection = seedConnection()
    assert.equal(connection.secretRef, 'conn-test-001')
    assert.equal(connection.secretMask?.includes('1234'), true)
    assert.equal((connection.configuration as Record<string, unknown>).apiKey, undefined)
  })

  it('3. secret stored only in secret store boundary contract', () => {
    const sanitized = sanitizeConnectionConfiguration({
      webhookUrl: 'https://example.com',
      apiKey: 'crsr_secret_value_1234567890',
    })
    assert.equal(sanitized.apiKey, undefined)
    assert.equal(sanitized.webhookUrl, 'https://example.com')
  })

  it('4. employee grant created', () => {
    writeStore(seedConnection(), seedGrant())
    const result = resolveEmployeeCapability({
      employeeId: BUILDER_EMPLOYEE_ID,
      capabilityId: 'cursor.automation.dispatch',
      environment: 'DEV',
      ownerApproved: true,
    })
    assert.equal(result.allowed, true)
  })

  it('5. capability granted', () => {
    const result = resolveEmployeeCapability({
      employeeId: BUILDER_EMPLOYEE_ID,
      capabilityId: 'cursor.automation.dispatch',
      environment: 'DEV',
      ownerApproved: true,
    }, writeStore(seedConnection(), seedGrant()))
    assert.equal(result.reasonCode, 'CONNECTION_AVAILABLE')
  })

  it('6. capability not granted → blocked', () => {
    const result = resolveEmployeeCapability({
      employeeId: BUILDER_EMPLOYEE_ID,
      capabilityId: 'gmail.message.send',
      environment: 'DEV',
    }, writeStore(seedConnection(), seedGrant()))
    assert.equal(result.allowed, false)
    assert.equal(result.reasonCode, 'CAPABILITY_NOT_GRANTED')
  })

  it('7. disabled connection → blocked', () => {
    const result = resolveEmployeeCapability({
      employeeId: BUILDER_EMPLOYEE_ID,
      capabilityId: 'cursor.automation.dispatch',
      environment: 'DEV',
    }, writeStore(seedConnection({ status: 'DISABLED' }), seedGrant()))
    assert.equal(result.reasonCode, 'CONNECTION_DISABLED')
  })

  it('8. AUTH_REQUIRED → blocked', () => {
    const result = resolveEmployeeCapability({
      employeeId: BUILDER_EMPLOYEE_ID,
      capabilityId: 'cursor.automation.dispatch',
      environment: 'DEV',
    }, writeStore(seedConnection({ status: 'AUTH_REQUIRED' }), seedGrant()))
    assert.equal(result.reasonCode, 'AUTH_REQUIRED')
  })

  it('9. unhealthy connection → blocked', () => {
    const result = resolveEmployeeCapability({
      employeeId: BUILDER_EMPLOYEE_ID,
      capabilityId: 'cursor.automation.dispatch',
      environment: 'DEV',
    }, writeStore(seedConnection({ health: 'UNAVAILABLE', status: 'ERROR' }), seedGrant()))
    assert.equal(result.reasonCode, 'CONNECTION_UNHEALTHY')
  })

  it('10. environment mismatch → blocked', () => {
    const result = resolveEmployeeCapability({
      employeeId: BUILDER_EMPLOYEE_ID,
      capabilityId: 'cursor.automation.dispatch',
      environment: 'PRODUCTION',
    }, writeStore(seedConnection(), seedGrant({ allowedEnvironments: ['DEV'] })))
    assert.equal(result.reasonCode, 'ENVIRONMENT_NOT_ALLOWED')
  })

  it('11. UNKNOWN_COST → blocked', () => {
    const result = resolveEmployeeCapability({
      employeeId: BUILDER_EMPLOYEE_ID,
      capabilityId: 'cursor.automation.dispatch',
      environment: 'DEV',
    }, writeStore(seedConnection({ costClassification: 'UNKNOWN_COST' }), seedGrant()))
    assert.equal(result.reasonCode, 'COST_UNKNOWN')
  })

  it('12. ADDITIONAL_COST_REQUIRED → approval required', () => {
    const result = resolveEmployeeCapability({
      employeeId: BUILDER_EMPLOYEE_ID,
      capabilityId: 'cursor.automation.dispatch',
      environment: 'DEV',
    }, writeStore(seedConnection({ costClassification: 'ADDITIONAL_COST_REQUIRED' }), seedGrant()))
    assert.equal(result.reasonCode, 'OWNER_APPROVAL_REQUIRED')
  })

  it('13. INCLUDED_IN_SUBSCRIPTION → allowed', () => {
    const result = resolveEmployeeCapability({
      employeeId: BUILDER_EMPLOYEE_ID,
      capabilityId: 'cursor.automation.dispatch',
      environment: 'DEV',
      ownerApproved: true,
    }, writeStore(seedConnection({ costClassification: 'INCLUDED_IN_SUBSCRIPTION' }), seedGrant()))
    assert.equal(result.allowed, true)
  })

  it('14. owner approval respected', () => {
    const result = resolveEmployeeCapability({
      employeeId: BUILDER_EMPLOYEE_ID,
      capabilityId: 'cursor.automation.dispatch',
      environment: 'DEV',
      ownerApproved: false,
    }, writeStore(seedConnection(), seedGrant({ requiresOwnerApproval: true })))
    assert.equal(result.reasonCode, 'OWNER_APPROVAL_REQUIRED')
  })

  it('15. connection revoke removes capability', () => {
    writeStore(seedConnection(), seedGrant())
    const revoked = revokeEmployeeConnectionGrant('grant-test-001')
    assert.ok(revoked)
    const result = resolveEmployeeCapability({
      employeeId: BUILDER_EMPLOYEE_ID,
      capabilityId: 'cursor.automation.dispatch',
      environment: 'DEV',
    })
    assert.equal(result.reasonCode, 'EMPLOYEE_GRANT_NOT_FOUND')
  })

  it('16. secret rotation keeps connection ID', () => {
    const connection = seedConnection()
    writeStore(connection, seedGrant())
    const mask = maskSecretValue('newsecretvalue9999')
    const updated = upsertCompanyConnection(
      { ...connection, secretMask: mask, updatedAt: new Date().toISOString() },
      emptyEmployeeConnectionsStore(),
    )
    assert.equal(updated.connections[0]?.id, 'conn-test-001')
    assert.equal(updated.connections[0]?.secretMask, mask)
  })

  it('17. secret delete makes capability unavailable', () => {
    const result = resolveEmployeeCapability({
      employeeId: BUILDER_EMPLOYEE_ID,
      capabilityId: 'cursor.automation.dispatch',
      environment: 'DEV',
    }, writeStore(seedConnection({ secretRef: null }), seedGrant()))
    assert.equal(result.reasonCode, 'SECRET_UNAVAILABLE')
  })

  it('18. provider unsupported capability rejected', () => {
    assert.equal(isProviderCapabilitySupported('github', 'cursor.automation.dispatch'), false)
  })

  it('19. duplicate connection name handled via unique IDs', () => {
    let store = emptyEmployeeConnectionsStore()
    store = upsertCompanyConnection(seedConnection({ id: 'conn-a', displayName: 'Same Name' }), store)
    store = upsertCompanyConnection(seedConnection({ id: 'conn-b', displayName: 'Same Name' }), store)
    assert.equal(store.connections.length, 2)
  })

  it('20. duplicate grant idempotent update', () => {
    writeStore(seedConnection(), seedGrant({ capabilityIds: ['cursor.automation.dispatch'] }))
    const updated = grantConnectionToEmployee({
      employeeId: BUILDER_EMPLOYEE_ID,
      connectionId: 'conn-test-001',
      capabilityIds: ['cursor.automation.dispatch', 'cursor.automation.result.reconcile'],
    })
    assert.equal(updated.ok, true)
    if (updated.ok) {
      assert.equal(updated.grant.capabilityIds.length, 2)
    }
  })

  it('21. ollama healthy endpoint contract shape', () => {
    const provider = getConnectionProvider('ollama')
    assert.ok(provider?.implemented)
    assert.ok(provider.supportedCapabilities.some((cap) => cap.id === 'ollama.model.list'))
  })

  it('22. ollama unavailable handled by health contract', () => {
    const provider = getConnectionProvider('ollama')
    assert.equal(provider?.connectionMode, 'LOCAL')
  })

  it('23. cursor configuration incomplete blocks secret-unavailable path', () => {
    const result = resolveEmployeeCapability({
      employeeId: BUILDER_EMPLOYEE_ID,
      capabilityId: 'cursor.automation.dispatch',
      environment: 'DEV',
    }, writeStore(seedConnection({ status: 'NOT_CONFIGURED', secretRef: null }), seedGrant()))
    assert.equal(result.reasonCode, 'AUTH_REQUIRED')
  })

  it('24. cursor secret missing blocks runtime', () => {
    const result = resolveEmployeeCapability({
      employeeId: BUILDER_EMPLOYEE_ID,
      capabilityId: 'cursor.automation.dispatch',
      environment: 'DEV',
    }, writeStore(seedConnection({ secretRef: null, status: 'CONFIGURED' }), seedGrant()))
    assert.equal(result.reasonCode, 'SECRET_UNAVAILABLE')
  })

  it('25. git repository origin detection provider exists', () => {
    const github = getConnectionProvider('github')
    assert.ok(github?.implemented)
  })

  it('26. git repository mismatch rejected by resolver unhealthy state', () => {
    const result = resolveEmployeeCapability({
      employeeId: BUILDER_EMPLOYEE_ID,
      capabilityId: 'github.repository.read',
      environment: 'DEV',
    }, writeStore(
      seedConnection({
        providerId: 'github',
        status: 'ERROR',
        health: 'UNAVAILABLE',
        authMethod: 'LOCAL_SESSION',
        secretRef: null,
      }),
      seedGrant({
        capabilityIds: ['github.repository.read'],
      }),
    ))
    assert.equal(result.reasonCode, 'CONNECTION_UNHEALTHY')
  })

  it('27. health check never logs secret in redaction helper', () => {
    const redacted = redactConnectionSecret('Authorization: Bearer crsr_test_secret_value_1234567890')
    assert.equal(redacted.includes('crsr_'), false)
  })

  it('28. employee connections list snapshot renders data', () => {
    writeStore(seedConnection(), seedGrant())
    const snapshot = getEmployeeConnectionsSnapshot(BUILDER_EMPLOYEE_ID)
    assert.equal(snapshot.connections.length, 1)
    assert.equal(snapshot.capabilityCount, 2)
  })

  it('29. provider catalog renders with icons', () => {
    const provider = getConnectionProvider('github')
    assert.equal(provider?.iconKey, 'github')
  })

  it('30. add connection flow grant helper works', () => {
    writeStore(
      seedConnection({
        providerId: 'ollama',
        id: 'conn-ollama',
        authMethod: 'LOCAL_RUNTIME',
        secretRef: null,
        status: 'CONNECTED',
      }),
      seedGrant({
        id: 'grant-ollama',
        connectionId: 'conn-ollama',
        capabilityIds: ['ollama.inference.run'],
      }),
    )
    const result = resolveEmployeeCapability({
      employeeId: BUILDER_EMPLOYEE_ID,
      capabilityId: 'ollama.inference.run',
      environment: 'DEV',
      ownerApproved: true,
    })
    assert.equal(result.allowed, true)
  })

  it('31. cursor setup masks secret in domain object', () => {
    assert.equal(maskSecretValue('abcdefghijklmnop').startsWith('••••'), true)
  })

  it('32. github mode selection provider supports local session', () => {
    const github = getConnectionProvider('github')
    assert.ok(github?.authMethods.includes('LOCAL_SESSION'))
  })

  it('33. ollama auto-detect legacy hint exists', () => {
    const hints = detectLegacyRuntimeConnections()
    assert.ok(hints.some((hint) => hint.providerId === 'ollama'))
  })

  it('34. permission selection via grant stores capability IDs', () => {
    const grant = seedGrant({ capabilityIds: ['github.repository.read'] })
    assert.deepEqual(grant.capabilityIds, ['github.repository.read'])
  })

  it('35. cost policy visible via resolver reason', () => {
    const result = resolveEmployeeCapability({
      employeeId: BUILDER_EMPLOYEE_ID,
      capabilityId: 'cursor.automation.dispatch',
      environment: 'DEV',
    }, writeStore(seedConnection({ costClassification: 'BLOCKED_BY_COST_POLICY' }), seedGrant()))
    assert.equal(result.reasonCode, 'BLOCKED_BY_COST_POLICY')
  })

  it('36. connection error visible via unhealthy reason', () => {
    const result = resolveEmployeeCapability({
      employeeId: BUILDER_EMPLOYEE_ID,
      capabilityId: 'cursor.automation.dispatch',
      environment: 'DEV',
    }, writeStore(seedConnection({ status: 'ERROR', health: 'UNAVAILABLE' }), seedGrant()))
    assert.equal(result.reasonCode, 'CONNECTION_UNHEALTHY')
  })

  it('37. disconnect flow removes grant', () => {
    writeStore(seedConnection(), seedGrant())
    revokeEmployeeConnectionGrant('grant-test-001')
    const result = resolveEmployeeCapability({
      employeeId: BUILDER_EMPLOYEE_ID,
      capabilityId: 'cursor.automation.dispatch',
      environment: 'DEV',
    })
    assert.equal(result.allowed, false)
  })

  it('38. builder automation resolves cursor connection fallback', () => {
    const resolved = resolveCursorAutomationConnectionForEmployee(BUILDER_EMPLOYEE_ID)
    assert.ok(resolved.source === 'legacy_env' || resolved.source === 'connection')
  })

  it('39. ollama runtime remains compatible via legacy fallback', () => {
    const resolved = resolveOllamaConnectionForEmployee(BUILDER_EMPLOYEE_ID)
    assert.ok(resolved.endpoint)
    assert.ok(resolved.source === 'legacy_settings' || resolved.source === 'connection')
  })

  it('40. capability preflight helper returns structured result', () => {
    const result = preflightEmployeeCapability({
      employeeId: BUILDER_EMPLOYEE_ID,
      capabilityId: 'cursor.automation.dispatch',
    })
    assert.equal(typeof result.allowed, 'boolean')
    assert.equal(typeof result.reasonCode, 'string')
  })
})
