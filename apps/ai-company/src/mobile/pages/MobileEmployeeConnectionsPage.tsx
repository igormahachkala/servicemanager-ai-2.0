import { Link, Navigate, useParams } from 'react-router-dom'
import { useI18n } from '../../i18n'
import {
  getDefaultMobileEmployeeId,
  mobileEmployeeProfilePath,
  resolveMobileEmployeeFromRoute,
} from '../../domain/mobileEmployee'
import { getConnectionProvider } from '../../domain/employeeConnections/connectionProviderCatalog'
import { ConnectionProviderIcon } from '../components/ConnectionProviderIcon'
import { MobileSection } from '../components/MobileSection'
import { useEmployeeConnections } from '../hooks/useEmployeeConnections'

export function MobileEmployeeConnectionsPage() {
  const { id: rawId } = useParams<{ id: string }>()
  const { t } = useI18n()
  const copy = t.mobile.employeeConnections
  const registryEntry = rawId ? resolveMobileEmployeeFromRoute(rawId) : null
  const employeeId = registryEntry?.employeeId ?? getDefaultMobileEmployeeId()
  const state = useEmployeeConnections(employeeId)

  if (!rawId) {
    return <Navigate to={`/mobile/employees/${getDefaultMobileEmployeeId()}/connections`} replace />
  }
  if (!registryEntry) {
    return <Navigate to={`/mobile/employees/${getDefaultMobileEmployeeId()}/connections`} replace />
  }

  const selectedProvider = state.selectedProviderId
    ? getConnectionProvider(state.selectedProviderId)
    : null

  return (
    <div className="acMobilePage acMobileConnectionsPage">
      <div className="acMobileConnectionsHeader">
        <Link to={mobileEmployeeProfilePath(employeeId)} className="acMobileSecondaryBtn">
          {copy.backToProfile}
        </Link>
        <h1>{copy.pageTitle}</h1>
        <p className="acMobileOwnerHomeMuted">
          {state.employeeProfile?.displayName ?? employeeId} ·{' '}
          {copy.header.connections.replace('{count}', String(state.snapshot.connections.length))} ·{' '}
          {copy.header.capabilities.replace('{count}', String(state.snapshot.capabilityCount))} ·{' '}
          {copy.header.issues.replace('{count}', String(state.snapshot.issueCount))}
        </p>
        {state.bridgeOnline === false ? (
          <p className="acMobileConnectionsWarning" role="status">
            {copy.setup.bridgeOffline}
          </p>
        ) : null}
        {state.message ? (
          <p className="acMobileConnectionsNotice" role="status">
            {state.message}
          </p>
        ) : null}
      </div>

      {state.legacyHints.length > 0 ? (
        <MobileSection title={copy.sections.legacy}>
          {state.legacyHints.map((hint) => (
            <div key={hint.providerId} className="acMobileConnectionLegacyCard">
              <strong>{hint.displayName}</strong>
              <p>{hint.message}</p>
            </div>
          ))}
        </MobileSection>
      ) : null}

      <MobileSection title={copy.sections.connected}>
        {state.snapshot.connections.length === 0 ? (
          <p>{copy.empty.connected}</p>
        ) : (
          state.snapshot.connections.map(({ grant, connection }) => {
            const provider = getConnectionProvider(connection.providerId)
            return (
              <article key={grant.id} className="acMobileConnectionCard">
                <div className="acMobileConnectionCardHead">
                  <ConnectionProviderIcon iconKey={provider?.iconKey ?? 'integration'} />
                  <div>
                    <strong>{connection.displayName}</strong>
                    <p>{provider?.name ?? connection.providerId}</p>
                  </div>
                </div>
                <dl className="acMobileConnectionMeta">
                  <div>
                    <dt>{copy.setup.environment}</dt>
                    <dd>{connection.environment}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{copy.status[connection.status] ?? connection.status}</dd>
                  </div>
                  <div>
                    <dt>Health</dt>
                    <dd>{copy.health[connection.health] ?? connection.health}</dd>
                  </div>
                  <div>
                    <dt>Capabilities</dt>
                    <dd>{grant.capabilityIds.length}</dd>
                  </div>
                </dl>
                <div className="acMobileConnectionActions">
                  <button
                    type="button"
                    className="acMobileSecondaryBtn"
                    disabled={state.busy}
                    onClick={() => void state.testConnection(connection.id)}
                  >
                    {copy.actions.test}
                  </button>
                  <button
                    type="button"
                    className="acMobileSecondaryBtn"
                    disabled={state.busy}
                    onClick={() => state.revokeGrant(grant.id)}
                  >
                    {copy.actions.revoke}
                  </button>
                  <button
                    type="button"
                    className="acMobileSecondaryBtn"
                    disabled={state.busy}
                    onClick={() => void state.disconnectConnection(connection.id, grant.id)}
                  >
                    {copy.actions.disconnect}
                  </button>
                </div>
              </article>
            )
          })
        )}
      </MobileSection>

      <MobileSection title={copy.sections.catalog}>
        <div className="acMobileConnectionFilters">
          {Object.entries(copy.filters).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={state.categoryFilter === key ? 'acMobilePrimaryBtn' : 'acMobileSecondaryBtn'}
              onClick={() => state.setCategoryFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {!selectedProvider ? (
          <div className="acMobileConnectionCatalog">
            {state.providers.map((provider) => (
              <button
                key={provider.id}
                type="button"
                className="acMobileConnectionCatalogCard"
                onClick={() => state.selectProvider(provider.id)}
              >
                <ConnectionProviderIcon iconKey={provider.iconKey} />
                <div>
                  <strong>{provider.name}</strong>
                  <p>{provider.description}</p>
                  {!provider.implemented ? <span>{copy.providerPlanned}</span> : null}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="acMobileConnectionSetup">
            <h2>{copy.setup.title.replace('{provider}', selectedProvider.name)}</h2>
            <p className="acMobileOwnerHomeMuted">{copy.setup.ephemeralHint}</p>

            <label className="acMobileField">
              <span>{copy.setup.connectionName}</span>
              <input
                value={state.draft.displayName}
                onChange={(event) =>
                  state.setDraft({ ...state.draft, displayName: event.target.value })
                }
              />
            </label>

            <label className="acMobileField">
              <span>{copy.setup.environment}</span>
              <select
                value={state.draft.environment}
                onChange={(event) =>
                  state.setDraft({
                    ...state.draft,
                    environment: event.target.value as typeof state.draft.environment,
                  })
                }
              >
                {selectedProvider.environments.map((environment) => (
                  <option key={environment} value={environment}>
                    {environment}
                  </option>
                ))}
              </select>
            </label>

            {selectedProvider.id === 'cursor-automations' ? (
              <>
                <label className="acMobileField">
                  <span>{copy.setup.webhookUrl}</span>
                  <input
                    value={String(state.draft.configuration.webhookUrl ?? '')}
                    onChange={(event) =>
                      state.setDraft({
                        ...state.draft,
                        configuration: {
                          ...state.draft.configuration,
                          webhookUrl: event.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label className="acMobileField">
                  <span>{copy.setup.bearerKey}</span>
                  <input
                    type="password"
                    value={state.draft.secretValue}
                    onChange={(event) =>
                      state.setDraft({ ...state.draft, secretValue: event.target.value })
                    }
                  />
                </label>
                <label className="acMobileField">
                  <span>{copy.setup.repositoryOwner}</span>
                  <input
                    value={String(state.draft.configuration.repositoryOwner ?? '')}
                    onChange={(event) =>
                      state.setDraft({
                        ...state.draft,
                        configuration: {
                          ...state.draft.configuration,
                          repositoryOwner: event.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label className="acMobileField">
                  <span>{copy.setup.repositoryName}</span>
                  <input
                    value={String(state.draft.configuration.repositoryName ?? '')}
                    onChange={(event) =>
                      state.setDraft({
                        ...state.draft,
                        configuration: {
                          ...state.draft.configuration,
                          repositoryName: event.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label className="acMobileField">
                  <span>{copy.setup.baseBranch}</span>
                  <input
                    value={String(state.draft.configuration.baseBranch ?? 'main')}
                    onChange={(event) =>
                      state.setDraft({
                        ...state.draft,
                        configuration: {
                          ...state.draft.configuration,
                          baseBranch: event.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label className="acMobileField">
                  <span>{copy.setup.branchPrefix}</span>
                  <input
                    value={String(state.draft.configuration.branchPrefix ?? 'cursor/')}
                    onChange={(event) =>
                      state.setDraft({
                        ...state.draft,
                        configuration: {
                          ...state.draft.configuration,
                          branchPrefix: event.target.value,
                        },
                      })
                    }
                  />
                </label>
              </>
            ) : null}

            {selectedProvider.id === 'github' ? (
              <>
                <label className="acMobileField">
                  <span>{copy.setup.githubMode}</span>
                  <select
                    value={String(state.draft.configuration.mode ?? 'local')}
                    onChange={(event) =>
                      state.setDraft({
                        ...state.draft,
                        authMethod: event.target.value === 'cli' ? 'LOCAL_SESSION' : 'LOCAL_RUNTIME',
                        configuration: { ...state.draft.configuration, mode: event.target.value },
                      })
                    }
                  >
                    <option value="local">{copy.setup.githubModeLocal}</option>
                    <option value="cli">{copy.setup.githubModeCli}</option>
                    <option value="oauth" disabled>
                      {copy.setup.githubModeOAuth}
                    </option>
                  </select>
                </label>
                <label className="acMobileField">
                  <span>{copy.setup.repositoryOwner}</span>
                  <input
                    value={String(state.draft.configuration.repositoryOwner ?? '')}
                    onChange={(event) =>
                      state.setDraft({
                        ...state.draft,
                        configuration: {
                          ...state.draft.configuration,
                          repositoryOwner: event.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label className="acMobileField">
                  <span>{copy.setup.repositoryName}</span>
                  <input
                    value={String(state.draft.configuration.repositoryName ?? '')}
                    onChange={(event) =>
                      state.setDraft({
                        ...state.draft,
                        configuration: {
                          ...state.draft.configuration,
                          repositoryName: event.target.value,
                        },
                      })
                    }
                  />
                </label>
              </>
            ) : null}

            {selectedProvider.id === 'ollama' ? (
              <>
                <label className="acMobileField">
                  <span>{copy.setup.endpoint}</span>
                  <input
                    value={String(state.draft.configuration.endpoint ?? 'http://127.0.0.1:11434')}
                    onChange={(event) =>
                      state.setDraft({
                        ...state.draft,
                        configuration: {
                          ...state.draft.configuration,
                          endpoint: event.target.value,
                        },
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="acMobileSecondaryBtn"
                  onClick={() => void state.autoDetectOllama()}
                >
                  {copy.actions.detectOllama}
                </button>
                <label className="acMobileField">
                  <span>{copy.setup.defaultModel}</span>
                  <input
                    value={String(state.draft.configuration.defaultModel ?? '')}
                    onChange={(event) =>
                      state.setDraft({
                        ...state.draft,
                        configuration: {
                          ...state.draft.configuration,
                          defaultModel: event.target.value,
                        },
                      })
                    }
                  />
                </label>
              </>
            ) : null}

            <fieldset className="acMobileConnectionCapabilities">
              <legend>{copy.setup.selectCapabilities}</legend>
              {selectedProvider.supportedCapabilities.map((capability) => (
                <label key={capability.id} className="acMobileCheckboxField">
                  <input
                    type="checkbox"
                    checked={state.draft.capabilityIds.includes(capability.id)}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...state.draft.capabilityIds, capability.id]
                        : state.draft.capabilityIds.filter((id) => id !== capability.id)
                      state.setDraft({ ...state.draft, capabilityIds: next })
                    }}
                  />
                  <span>{capability.label}</span>
                </label>
              ))}
            </fieldset>

            <label className="acMobileCheckboxField">
              <input
                type="checkbox"
                checked={state.draft.requiresOwnerApproval}
                onChange={(event) =>
                  state.setDraft({ ...state.draft, requiresOwnerApproval: event.target.checked })
                }
              />
              <span>{copy.setup.ownerApproval}</span>
            </label>

            <div className="acMobileConnectionActions">
              <button
                type="button"
                className="acMobilePrimaryBtn"
                disabled={state.busy || !selectedProvider.implemented}
                onClick={() => void state.saveAndGrant()}
              >
                {copy.actions.save}
              </button>
              <button type="button" className="acMobileSecondaryBtn" onClick={state.clearSelection}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </MobileSection>
    </div>
  )
}
