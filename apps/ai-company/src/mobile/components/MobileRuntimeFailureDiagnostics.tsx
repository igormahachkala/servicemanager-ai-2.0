import { useState } from 'react'
import type { RuntimeFailureDiagnostics } from '../../domain/runtime/runtimeFailureDiagnostics'
import type { RuntimeFailureHint } from '../../domain/runtime/runtimeFailureDiagnostics'
import { useI18n } from '../../i18n'

type Props = {
  diagnostics: RuntimeFailureDiagnostics
  hint: RuntimeFailureHint
}

function DiagnosticsRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="acMobileRuntimeDiagRow">
      <dt>{label}</dt>
      <dd className="acMobileRuntimeDiagValue">{value}</dd>
    </div>
  )
}

export function MobileRuntimeFailureDiagnostics({ diagnostics, hint }: Props) {
  const { t } = useI18n()
  const copy = t.mobile.runtimeLive.failureDiagnostics
  const [copied, setCopied] = useState(false)

  const copyPayload = async () => {
    const text = [
      diagnostics.errorMessage,
      diagnostics.rawError,
      diagnostics.errorStack,
    ]
      .filter(Boolean)
      .join('\n\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="acMobileRuntimeFailureDiagnostics" aria-label={copy.title}>
      <details className="acMobileRuntimeFailureDetails">
        <summary className="acMobileRuntimeFailureSummary">{copy.title}</summary>

        <div className="acMobileRuntimeFailureBody">
          {hint === 'network' ? (
            <p className="acMobileRuntimeFailureHint">{copy.hints.network}</p>
          ) : null}
          {hint === 'model_missing' ? (
            <p className="acMobileRuntimeFailureHint">{copy.hints.modelMissing}</p>
          ) : null}

          <dl className="acMobileRuntimeFailureMeta">
            <DiagnosticsRow label={copy.fields.runtimeRunId} value={diagnostics.runtimeRunId} />
            <DiagnosticsRow label={copy.fields.workerLoopId} value={diagnostics.workerLoopId} />
            <DiagnosticsRow label={copy.fields.phase} value={diagnostics.phase} />
            <DiagnosticsRow label={copy.fields.model} value={diagnostics.model} />
            <DiagnosticsRow label={copy.fields.endpoint} value={diagnostics.endpoint} />
            <DiagnosticsRow
              label={copy.fields.effectiveEndpoint}
              value={diagnostics.effectiveEndpoint}
            />
            <DiagnosticsRow label={copy.fields.provider} value={diagnostics.provider} />
            <DiagnosticsRow
              label={copy.fields.httpStatus}
              value={diagnostics.httpStatus != null ? String(diagnostics.httpStatus) : null}
            />
            <DiagnosticsRow label={copy.fields.errorName} value={diagnostics.errorName} />
            <DiagnosticsRow label={copy.fields.errorMessage} value={diagnostics.errorMessage} />
          </dl>

          {diagnostics.rawError ? (
            <div className="acMobileRuntimeFailureRaw">
              <span className="acMobileRuntimeFailureRawLabel">{copy.fields.rawError}</span>
              <pre className="acMobileRuntimeFailureRawPre">{diagnostics.rawError}</pre>
            </div>
          ) : null}

          <button type="button" className="acMobileSecondaryBtn acMobileRuntimeFailureCopy" onClick={() => void copyPayload()}>
            {copied ? copy.copied : copy.copy}
          </button>
        </div>
      </details>
    </section>
  )
}
