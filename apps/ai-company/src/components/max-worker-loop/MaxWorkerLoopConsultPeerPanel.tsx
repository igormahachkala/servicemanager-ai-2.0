import type { MaxWorkerLoopPeerConsultationSnapshot } from '../../domain/maxWorkerLoop/maxWorkerLoopPeerConsultation'
import { useI18n } from '../../i18n'

type Props = {
  snapshot: MaxWorkerLoopPeerConsultationSnapshot
  compact?: boolean
}

export function MaxWorkerLoopConsultPeerPanel({ snapshot, compact = false }: Props) {
  const { t } = useI18n()
  const labels = t.maxWorkerLoop.consultPeer

  if (snapshot.status === 'skipped') {
    return (
      <section
        className={`acMaxLoopConsultPeer acMaxLoopConsultPeerSkipped${compact ? ' acMaxLoopConsultPeerCompact' : ''}`}
        aria-label={labels.title}
      >
        <h4 className="acMaxLoopConsultPeerTitle">{labels.title}</h4>
        <p className="acMaxLoopConsultPeerSkipReason">{snapshot.skipReason ?? labels.skippedDefault}</p>
      </section>
    )
  }

  if (snapshot.status === 'failed') {
    return (
      <section
        className={`acMaxLoopConsultPeer acMaxLoopConsultPeerFailed${compact ? ' acMaxLoopConsultPeerCompact' : ''}`}
        aria-label={labels.title}
      >
        <h4 className="acMaxLoopConsultPeerTitle">{labels.title}</h4>
        <p className="acMaxLoopError">{snapshot.skipReason ?? labels.failedDefault}</p>
      </section>
    )
  }

  return (
    <section
      className={`acMaxLoopConsultPeer${compact ? ' acMaxLoopConsultPeerCompact' : ''}`}
      aria-label={labels.title}
    >
      <h4 className="acMaxLoopConsultPeerTitle">{labels.title}</h4>
      <dl className="acMaxLoopConsultPeerGrid">
        <div>
          <dt>{labels.askedWho}</dt>
          <dd>{snapshot.peerDisplayName ?? snapshot.peerEmployeeId ?? '—'}</dd>
        </div>
        <div>
          <dt>{labels.whyAsked}</dt>
          <dd>{snapshot.consultReason ?? '—'}</dd>
        </div>
      </dl>

      {snapshot.questionBody ? (
        <div className="acMaxLoopConsultPeerBlock">
          <span className="acMaxLoopConsultPeerLabel">{labels.question}</span>
          <p>{snapshot.questionBody}</p>
        </div>
      ) : null}

      {snapshot.answerBody ? (
        <div className="acMaxLoopConsultPeerBlock">
          <span className="acMaxLoopConsultPeerLabel">{labels.answer}</span>
          <p>{snapshot.answerBody}</p>
        </div>
      ) : null}

      {snapshot.decisionSummary ? (
        <div className="acMaxLoopConsultPeerBlock">
          <span className="acMaxLoopConsultPeerLabel">{labels.decision}</span>
          <p>{snapshot.decisionSummary}</p>
        </div>
      ) : null}

      {snapshot.taskEnrichment ? (
        <div className="acMaxLoopConsultPeerBlock">
          <span className="acMaxLoopConsultPeerLabel">{labels.usedInTask}</span>
          <p className="mcMono acMaxLoopConsultPeerEnrichment">{snapshot.taskEnrichment}</p>
        </div>
      ) : null}
    </section>
  )
}
