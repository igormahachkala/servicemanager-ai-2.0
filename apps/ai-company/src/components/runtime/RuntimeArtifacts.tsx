import { Link } from 'react-router-dom'
import type { RuntimeArtifact } from '../../domain/runtime/runtimeOrchestrator'
import { useI18n } from '../../i18n'

export function RuntimeArtifacts({ artifacts }: { artifacts: RuntimeArtifact[] }) {
  const { t } = useI18n()

  if (artifacts.length === 0) {
    return <p className="mcMuted">{t.runtimeOrchestrator.noArtifacts}</p>
  }

  return (
    <ul className="mcRuntimeArtifacts">
      {artifacts.map((artifact) => (
        <li key={artifact.id} className="mcRuntimeArtifactItem">
          <span className="mcRuntimeArtifactKind">{artifact.kind}</span>
          <span>{artifact.label}</span>
          {artifact.kind === 'report' ? (
            <Link to={`/ops/reports/${artifact.refId}`} className="mcLinkInline">
              {t.runtimeOrchestrator.openReport}
            </Link>
          ) : (
            <span className="mcMono mcMuted">{artifact.refId}</span>
          )}
        </li>
      ))}
    </ul>
  )
}
