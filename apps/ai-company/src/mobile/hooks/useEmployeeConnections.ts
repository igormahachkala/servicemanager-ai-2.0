/**
 * Employee Connections — mobile hook (AI-COMPANY-115).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { resolveRegistryProfile } from '../../domain/employeeRegistry/employeeRegistryStorage'
import { BUILDER_EMPLOYEE_ID } from '../../domain/mobileEmployee'
import {
  buildDefaultGrantCapabilities,
  createCompanyConnection,
  deleteCompanyConnection,
  getEmployeeConnectionsSnapshot,
  grantConnectionToEmployee,
  revokeEmployeeConnectionGrant,
  testCompanyConnection,
} from '../../domain/employeeConnections/employeeConnectionsService'
import { detectLegacyRuntimeConnections } from '../../domain/employeeConnections/detectLegacyRuntimeConnections'
import { listConnectionProviders } from '../../domain/employeeConnections/connectionProviderCatalog'
import { connectionSecretStoreClient } from '../../domain/employeeConnections/employeeConnectionsService'
import { detectOllamaEndpointViaBridge } from '../../domain/employeeConnections/connectionSecretStoreClient'
import {
  EMPLOYEE_CONNECTIONS_SYNC_EVENT,
  loadEmployeeConnectionsStore,
} from '../../domain/employeeConnections/employeeConnectionsStorage'
import type {
  ConnectionAuthMethod,
  ConnectionEnvironment,
  ConnectionProviderDefinition,
  ConnectionSpendingPolicy,
} from '../../domain/employeeConnections/employeeConnectionsTypes'

export type ConnectionSetupDraft = {
  providerId: string
  displayName: string
  authMethod: ConnectionAuthMethod
  environment: ConnectionEnvironment
  configuration: Record<string, unknown>
  secretValue: string
  capabilityIds: string[]
  spendingPolicy: ConnectionSpendingPolicy
  requiresOwnerApproval: boolean
}

const EMPTY_DRAFT: ConnectionSetupDraft = {
  providerId: '',
  displayName: '',
  authMethod: 'API_KEY',
  environment: 'DEV',
  configuration: {},
  secretValue: '',
  capabilityIds: [],
  spendingPolicy: 'INCLUDED_ONLY',
  requiresOwnerApproval: false,
}

export function useEmployeeConnections(employeeId: string) {
  const [tick, setTick] = useState(0)
  const [bridgeOnline, setBridgeOnline] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ConnectionSetupDraft>(EMPTY_DRAFT)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const refresh = useCallback(() => setTick((value) => value + 1), [])

  useEffect(() => {
    void connectionSecretStoreClient.probeBridge().then(setBridgeOnline)
    const onSync = () => refresh()
    window.addEventListener(EMPLOYEE_CONNECTIONS_SYNC_EVENT, onSync)
    return () => window.removeEventListener(EMPLOYEE_CONNECTIONS_SYNC_EVENT, onSync)
  }, [refresh])

  const snapshot = useMemo(() => {
    void tick
    return getEmployeeConnectionsSnapshot(employeeId, loadEmployeeConnectionsStore())
  }, [employeeId, tick])

  const employeeProfile = useMemo(() => resolveRegistryProfile(employeeId), [employeeId])
  const providers = useMemo(() => listConnectionProviders(), [])
  const legacyHints = useMemo(() => detectLegacyRuntimeConnections(), [tick])

  const filteredProviders = useMemo(() => {
    if (categoryFilter === 'all') return providers
    const map: Record<string, ConnectionProviderDefinition['category']> = {
      development: 'DEVELOPMENT',
      aiModels: 'AI_MODELS',
      communication: 'COMMUNICATION',
      documents: 'DOCUMENTS',
      automation: 'AUTOMATION',
      corporate: 'CORPORATE_SYSTEMS',
    }
    const category = map[categoryFilter]
    return category ? providers.filter((provider) => provider.category === category) : providers
  }, [categoryFilter, providers])

  const selectProvider = useCallback(
    (providerId: string) => {
      const provider = providers.find((item) => item.id === providerId)
      if (!provider) return
      setSelectedProviderId(providerId)
      setDraft({
        providerId,
        displayName: `${provider.name} — ${employeeProfile?.displayName ?? employeeId}`,
        authMethod: provider.authMethods[0] ?? 'NONE',
        environment: provider.environments.includes('DEV') ? 'DEV' : provider.environments[0],
        configuration: {},
        secretValue: '',
        capabilityIds: buildDefaultGrantCapabilities(employeeId, providerId),
        spendingPolicy: 'INCLUDED_ONLY',
        requiresOwnerApproval: false,
      })
      setMessage(null)
    },
    [employeeId, employeeProfile?.displayName, providers],
  )

  const saveAndGrant = useCallback(async () => {
    if (!draft.providerId) return
    setBusy(true)
    setMessage(null)
    try {
      const created = await createCompanyConnection({
        providerId: draft.providerId,
        displayName: draft.displayName,
        authMethod: draft.authMethod,
        environment: draft.environment,
        configuration: draft.configuration,
        secret: draft.secretValue
          ? { type: draft.authMethod, value: draft.secretValue }
          : null,
      })
      if (!created.ok) {
        setMessage(created.message)
        return
      }
      const granted = grantConnectionToEmployee({
        employeeId,
        connectionId: created.connection.id,
        capabilityIds: draft.capabilityIds,
        requiresOwnerApproval: draft.requiresOwnerApproval,
        allowedEnvironments: [draft.environment],
        spendingPolicy: draft.spendingPolicy,
      })
      if (!granted.ok) {
        setMessage(granted.message)
        return
      }
      await testCompanyConnection(created.connection.id)
      setSelectedProviderId(null)
      setDraft(EMPTY_DRAFT)
      refresh()
      setMessage('Connection saved.')
    } finally {
      setBusy(false)
    }
  }, [draft, employeeId, refresh])

  const testConnection = useCallback(async (connectionId: string) => {
    setBusy(true)
    setMessage(null)
    try {
      const result = await testCompanyConnection(connectionId)
      setMessage(result?.message ?? 'Health check completed.')
      refresh()
    } finally {
      setBusy(false)
    }
  }, [refresh])

  const revokeGrant = useCallback(
    (grantId: string) => {
      revokeEmployeeConnectionGrant(grantId)
      refresh()
    },
    [refresh],
  )

  const disconnectConnection = useCallback(async (connectionId: string, grantId: string) => {
    setBusy(true)
    try {
      revokeEmployeeConnectionGrant(grantId)
      await deleteCompanyConnection(connectionId)
      refresh()
    } finally {
      setBusy(false)
    }
  }, [refresh])

  const autoDetectOllama = useCallback(async () => {
    const detected = await detectOllamaEndpointViaBridge()
    if (!detected.detected || !detected.endpoint) {
      setMessage('Ollama not detected on localhost.')
      return
    }
    setDraft((current) => ({
      ...current,
      providerId: 'ollama',
      displayName: current.displayName || 'Ollama Local',
      authMethod: 'LOCAL_RUNTIME',
      configuration: {
        ...current.configuration,
        endpoint: detected.endpoint,
        defaultModel: detected.models[0] ?? '',
        allowedModels: detected.models,
      },
    }))
    setMessage(`Detected ${detected.models.length} models.`)
  }, [])

  return {
    employeeProfile,
    snapshot,
    providers: filteredProviders,
    allProviders: providers,
    legacyHints,
    bridgeOnline,
    busy,
    message,
    selectedProviderId,
    draft,
    categoryFilter,
    setCategoryFilter,
    setDraft,
    selectProvider,
    clearSelection: () => {
      setSelectedProviderId(null)
      setDraft(EMPTY_DRAFT)
    },
    saveAndGrant,
    testConnection,
    revokeGrant,
    disconnectConnection,
    autoDetectOllama,
    refresh,
    isBuilder: employeeId === BUILDER_EMPLOYEE_ID,
  }
}
