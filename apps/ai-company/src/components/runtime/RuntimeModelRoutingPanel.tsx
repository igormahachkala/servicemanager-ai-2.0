import {
  formatRuntimeModelSpeed,
  resolveRuntimeModelRoute,
  type RuntimeModelMode,
  type RuntimeModelRoute,
} from '../../domain/runtime/runtimeModelRouting'
import type { RuntimeProfile } from '../../domain/runtime/runtimeProfile'
import type { RuntimeResult } from '../../domain/runtime/runtimeResult'
import { getProviderById } from '../../domain/runtime/modelProvider'
import { useI18n } from '../../i18n'

type Props = {
  employeeId: string
  profile: RuntimeProfile | null
  modelMode?: RuntimeModelMode | null
  result?: RuntimeResult | null
  compact?: boolean
}

function routeFromResult(result: RuntimeResult): Partial<RuntimeModelRoute> {
  const provider = getProviderById(result.selectedProvider)
  return {
    catalogModelLabel: result.catalogModelLabel,
    resolvedOllamaTag: result.resolvedOllamaTag ?? result.ollamaModelTag,
    modelMode: result.modelMode,
    estimatedSpeed: result.estimatedSpeed,
    estimatedContext: result.estimatedContext,
    expectedTimeoutMs: result.expectedTimeoutMs,
    providerName: provider?.name ?? result.selectedProvider,
    executionProviderId: result.executionProviderId,
    runtimeProfileId: result.runtimeProfileId,
    fastTestMode: result.fastTestMode,
  }
}

export function RuntimeModelRoutingPanel({
  employeeId,
  profile,
  modelMode,
  result,
  compact = false,
}: Props) {
  const { t } = useI18n()

  if (!profile && !result) {
    return <p className="mcMuted">{t.runtimeModelRouting.empty}</p>
  }

  const route: RuntimeModelRoute | Partial<RuntimeModelRoute> = profile
    ? resolveRuntimeModelRoute({ employeeId, profile, modelMode })
    : routeFromResult(result!)

  const rows: Array<{ label: string; value: string }> = [
    {
      label: t.runtimeModelRouting.provider,
      value: route.providerName ?? '—',
    },
    {
      label: t.runtimeModelRouting.executionProvider,
      value: route.executionProviderId ?? '—',
    },
    {
      label: t.runtimeModelRouting.runtimeProfile,
      value: route.runtimeProfileId ?? profile?.id ?? '—',
    },
    {
      label: t.runtimeModelRouting.modelMode,
      value: route.modelMode ? t.runtimeModelRouting.modes[route.modelMode] : '—',
    },
    {
      label: t.runtimeModelRouting.catalogModel,
      value: route.catalogModelLabel ?? '—',
    },
    {
      label: t.runtimeModelRouting.resolvedOllamaModel,
      value: route.resolvedOllamaTag ?? '—',
    },
    {
      label: t.runtimeModelRouting.estimatedSpeed,
      value: route.estimatedSpeed ? formatRuntimeModelSpeed(route.estimatedSpeed) : '—',
    },
    {
      label: t.runtimeModelRouting.estimatedContext,
      value:
        route.estimatedContext != null
          ? t.runtimeModelRouting.contextTokens.replace('{count}', String(route.estimatedContext))
          : '—',
    },
    {
      label: t.runtimeModelRouting.expectedTimeout,
      value:
        route.expectedTimeoutMs != null
          ? t.runtimeModelRouting.timeoutSeconds.replace(
              '{seconds}',
              String(Math.round(route.expectedTimeoutMs / 1000)),
            )
          : '—',
    },
  ]

  return (
    <div className={`mcRuntimeRoutingPanel${compact ? ' mcRuntimeRoutingPanelCompact' : ''}`}>
      {!compact && 'routingReason' in route && route.routingReason ? (
        <p className="mcRuntimeRoutingReason mcMuted">{route.routingReason}</p>
      ) : null}
      {route.fastTestMode ? (
        <span className="mcRuntimeAdapterStatus mcRuntimeAdapterStatusMock">
          {t.runtimeProviders.fastTestMode}
        </span>
      ) : null}
      <div className="mcRuntimeRoutingGrid">
        {rows.map((row) => (
          <div key={row.label} className="mcRuntimeProfileRow">
            <span>{row.label}</span>
            <span className="mcMono">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
