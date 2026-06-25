import { Link } from 'react-router-dom'
import type { RunArtifact } from '../../domain/run/runStorage'
import { useI18n } from '../../i18n'

export function RunArtifacts({ artifacts }: { artifacts: RunArtifact[] }) {
  const { t } = useI18n()

  if (artifacts.length === 0) {
    return <p className="mcMuted">{t.runEngine.emptyArtifacts}</p>
  }

  return (
    <div className="mcRunArtifactGrid">
      {artifacts.map((artifact) => (
        <div key={artifact.id} className="mcRunArtifactCard">
          <div className="mcRunArtifactHead">
            <span className="mcRunArtifactKind mcMono">{t.runEngine.artifactKinds[artifact.kind]}</span>
            {artifact.placeholder ? (
              <span className="mcRunArtifactPlaceholder">{t.runEngine.placeholderBadge}</span>
            ) : null}
          </div>
          <div className="mcRunArtifactLabel">{artifact.label}</div>
          {artifact.refId && artifact.kind === 'generated_report' ? (
            <Link to={`/ops/reports/${artifact.refId}`} className="mcBtn mcBtnSecondary mcBtnSmall">
              {t.runEngine.openReport}
            </Link>
          ) : artifact.refId ? (
            <span className="mcMono mcMuted">{artifact.refId}</span>
          ) : null}
        </div>
      ))}
    </div>
  )
}
