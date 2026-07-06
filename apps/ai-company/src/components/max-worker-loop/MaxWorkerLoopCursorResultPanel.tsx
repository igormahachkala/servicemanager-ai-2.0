import type { MaxWorkerLoopSnapshot } from '../../domain/maxWorkerLoop'
import { useI18n } from '../../i18n'

type Props = {
  snapshot: MaxWorkerLoopSnapshot
  compact?: boolean
}

export function MaxWorkerLoopCursorResultPanel({ snapshot, compact = false }: Props) {
  const { t } = useI18n()
  const integration = snapshot.cursorAutomation.resultIntegration

  if (!integration) return null

  const labels = t.maxWorkerLoop.cursorResult

  return (
    <section className="acMaxLoopCursorResult" aria-label={labels.title}>
      <h4 className="acMaxLoopCursorResultTitle">{labels.title}</h4>
      <p className="acMaxLoopCursorResultMeta mcMuted">
        {labels.source}: {integration.source} · {new Date(integration.ingestedAt).toLocaleString('ru-RU')}
      </p>

      <div className="acMaxLoopCursorResultGrid">
        <article className="acMaxLoopCursorResultCard">
          <h5>{labels.cursorReturned}</h5>
          <p>{integration.runtimeReportPatch.reportSummary}</p>
          {integration.runtimeReportPatch.pullRequestUrl ? (
            <p className="mcMono mcMuted">{integration.runtimeReportPatch.pullRequestUrl}</p>
          ) : null}
          <p className="mcMuted">
            {labels.buildStatus}: {integration.runtimeReportPatch.buildStatus}
          </p>
        </article>

        <article className="acMaxLoopCursorResultCard">
          <h5>{labels.maxAccepted}</h5>
          <p>
            <span className={`acMaxLoopReviewBadge acMaxLoopReviewBadge${integration.maxReview.status === 'accepted' ? 'Accepted' : 'Pending'}`}>
              {labels.reviewStatus[integration.maxReview.status]}
            </span>
          </p>
          <p>{integration.maxReview.summary}</p>
        </article>

        {!compact ? (
          <>
            <article className="acMaxLoopCursorResultCard">
              <h5>{labels.reportPatch}</h5>
              <p>{integration.runtimeReportPatch.summary}</p>
              <p className="mcMuted">{integration.runtimeReportPatch.note}</p>
              <ul className="acMaxLoopToolBranchList">
                {integration.runtimeReportPatch.sections.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="acMaxLoopCursorResultCard">
              <h5>{labels.memoryDraft}</h5>
              <p className="mcMuted">{labels.draftOnlyNote}</p>
              <ul className="acMaxLoopToolBranchList">
                {integration.memoryHints.map((hint) => (
                  <li key={hint.id}>
                    <strong>{hint.title}</strong> — {hint.content.slice(0, 120)}
                  </li>
                ))}
              </ul>
            </article>

            <article className="acMaxLoopCursorResultCard">
              <h5>{labels.knowledgeCandidates}</h5>
              <p className="mcMuted">{labels.draftOnlyNote}</p>
              <ul className="acMaxLoopToolBranchList">
                {integration.knowledgeCandidates.map((item) => (
                  <li key={item.id}>
                    {item.title}
                    {item.proposedRulePath ? (
                      <span className="mcMono mcMuted"> → {item.proposedRulePath}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </article>

            <article className="acMaxLoopCursorResultCard">
              <h5>{labels.cursorRules}</h5>
              <p className="mcMuted">{labels.rulesNote}</p>
              <ul className="acMaxLoopToolBranchList">
                {integration.ruleCandidates.map((rule) => (
                  <li key={rule.id}>
                    <span className="mcMono">{rule.proposedPath}</span> — {rule.title}
                  </li>
                ))}
              </ul>
            </article>

            <article className="acMaxLoopCursorResultCard acMaxLoopCursorResultCardWide">
              <h5>{labels.historyEvents}</h5>
              <ul className="acMaxLoopToolBranchList">
                {integration.historyEvents.map((event) => (
                  <li key={event.draftId}>
                    <strong>{event.label}</strong>
                    {event.detail ? ` · ${event.detail}` : ''}
                  </li>
                ))}
              </ul>
            </article>
          </>
        ) : null}
      </div>
    </section>
  )
}
