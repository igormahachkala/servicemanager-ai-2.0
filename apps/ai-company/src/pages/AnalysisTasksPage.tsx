import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { useI18n } from '../i18n'
import { isSafeToolAutoApproveEnabled } from '../domain/toolDispatcher'
import {
  acceptToolExecutionResult,
  approveToolExecutionRun,
  rejectToolExecutionRun,
} from '../domain/toolExecution/toolExecutionRunStorage'
import { TOOL_EXECUTION_RUN_SYNC_EVENT } from '../domain/toolExecution/toolExecutionRunTypes'
import {
  buildOllamaAnalysisView,
  createOllamaAnalysisTask,
  listOllamaAnalysisRuns,
  type OllamaAnalysisPhase,
  type OllamaAnalysisView,
} from '../domain/ollamaAnalysis/ollamaAnalysisTask'

const PHASE_DOT: Record<OllamaAnalysisPhase, string> = {
  waiting_owner: 'mcDot mcDotAmber',
  in_progress: 'mcDot mcDotAmber acAnalysisPulse',
  done: 'mcDot mcDotGreen',
  accepted: 'mcDot mcDotGreen',
  failed: 'mcDot mcDotRed',
  closed: 'mcDot mcDotGray',
}

function useAnalysisViews(): { views: OllamaAnalysisView[]; refresh: () => void } {
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    window.addEventListener(TOOL_EXECUTION_RUN_SYNC_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(TOOL_EXECUTION_RUN_SYNC_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [refresh])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const views = useMemo(() => listOllamaAnalysisRuns().map(buildOllamaAnalysisView), [tick])

  // The executor runs detached; poll while anything is in flight so the status
  // and the answer appear without a manual reload.
  const busy = views.some((v) => v.phase === 'in_progress')
  useEffect(() => {
    if (!busy) return
    const id = window.setInterval(refresh, 2000)
    return () => window.clearInterval(id)
  }, [busy, refresh])

  return { views, refresh }
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

export function AnalysisTasksPage() {
  const { t } = useI18n()
  const c = t.analysisTasks
  const { views, refresh } = useAnalysisViews()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [error, setError] = useState<string | null>(null)
  const autoApprove = isSafeToolAutoApproveEnabled()

  const selected = views.find((v) => v.runId === selectedId) ?? views[0] ?? null

  function startTask(taskTitle: string, taskInstructions: string) {
    setError(null)
    try {
      const run = createOllamaAnalysisTask({ title: taskTitle, instructions: taskInstructions })
      setSelectedId(run.id)
      refresh()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return false
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (startTask(title, instructions)) {
      setTitle('')
      setInstructions('')
    }
  }

  return (
    <>
      <PageHeader title={c.pageTitle} description={c.pageDescription} />

      <div className="acAnalysisLayout">
        <div className="acAnalysisSide">
          <Panel title={c.form.title}>
            <form className="acAnalysisForm" onSubmit={onSubmit}>
              <label className="mcField">
                <span className="mcFieldLabel">{c.form.titleLabel}</span>
                <input
                  className="mcInput"
                  value={title}
                  placeholder={c.form.titlePlaceholder}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="mcField">
                <span className="mcFieldLabel">{c.form.instructionsLabel}</span>
                <textarea
                  className="mcTextarea"
                  rows={7}
                  value={instructions}
                  placeholder={c.form.instructionsPlaceholder}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </label>
              <p className="mcMuted acAnalysisNote">
                {autoApprove ? c.form.autoApproveNote : c.form.manualApproveNote}
              </p>
              {error ? <p className="acAnalysisError">{error}</p> : null}
              <button
                type="submit"
                className="mcBtn mcBtnPrimary"
                disabled={!title.trim() || !instructions.trim()}
              >
                {c.form.submit}
              </button>
            </form>
          </Panel>

          <Panel title={c.list.title} right={<span className="mcMono mcMuted">{views.length}</span>}>
            {views.length === 0 ? (
              <p className="mcMuted">{c.list.empty}</p>
            ) : (
              <ul className="acAnalysisList">
                {views.map((v) => (
                  <li key={v.runId}>
                    <button
                      type="button"
                      className={
                        v.runId === selected?.runId
                          ? 'acAnalysisItem acAnalysisItemActive'
                          : 'acAnalysisItem'
                      }
                      onClick={() => setSelectedId(v.runId)}
                    >
                      <span className={PHASE_DOT[v.phase]} aria-hidden />
                      <span className="acAnalysisItemBody">
                        <span className="acAnalysisItemTitle">{v.title}</span>
                        <span className="mcMuted acAnalysisItemMeta">
                          {c.phase[v.phase]} · {formatTime(v.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="acAnalysisMain">
          {selected ? (
            <AnalysisDetail
              view={selected}
              onChanged={refresh}
              onRerun={() => startTask(selected.title, selected.instructions)}
            />
          ) : (
            <Panel title={c.detail.answer}>
              <p className="mcMuted">{c.detail.empty}</p>
            </Panel>
          )}
        </div>
      </div>
    </>
  )
}

function AnalysisDetail(props: {
  view: OllamaAnalysisView
  onChanged: () => void
  onRerun: () => void
}) {
  const { t } = useI18n()
  const c = t.analysisTasks
  const v = props.view
  const m = v.metrics

  return (
    <>
      <Panel
        title={v.title}
        right={
          <span className="acAnalysisStatus">
            <span className={PHASE_DOT[v.phase]} aria-hidden />
            {c.phase[v.phase]}
          </span>
        }
      >
        <div className="acAnalysisTaskText">{v.instructions}</div>
        <div className="acAnalysisActions">
          {v.canApprove ? (
            <>
              <button
                type="button"
                className="mcBtn mcBtnPrimary"
                onClick={() => {
                  approveToolExecutionRun(v.runId, 'Owner approved analysis.')
                  props.onChanged()
                }}
              >
                {c.detail.approve}
              </button>
              <button
                type="button"
                className="mcBtn mcBtnSecondary"
                onClick={() => {
                  rejectToolExecutionRun(v.runId, 'Owner rejected analysis.')
                  props.onChanged()
                }}
              >
                {c.detail.reject}
              </button>
            </>
          ) : null}
          {v.canAccept ? (
            <button
              type="button"
              className="mcBtn mcBtnPrimary"
              onClick={() => {
                acceptToolExecutionResult(v.runId, 'Owner accepted analysis.')
                props.onChanged()
              }}
            >
              {c.detail.accept}
            </button>
          ) : null}
          {v.phase === 'done' || v.phase === 'accepted' || v.phase === 'failed' || v.phase === 'closed' ? (
            <button type="button" className="mcBtn mcBtnSecondary" onClick={props.onRerun}>
              {c.detail.rework}
            </button>
          ) : null}
        </div>
      </Panel>

      <Panel
        title={c.detail.answer}
        right={
          v.sectionsValidated === null ? null : (
            <span className={v.sectionsValidated ? 'acAnalysisOk' : 'acAnalysisWarn'}>
              {v.sectionsValidated ? c.detail.sectionsOk : c.detail.sectionsBad}
            </span>
          )
        }
      >
        {v.phase === 'in_progress' ? <p className="mcMuted">{c.detail.working}</p> : null}

        {v.sectionsValidated === false &&
        (v.missingSections.length > 0 || v.emptySections.length > 0) ? (
          <p className="acAnalysisWarn">
            {v.missingSections.length > 0
              ? `${c.detail.missing}: ${v.missingSections.join(', ')}`
              : null}
            {v.missingSections.length > 0 && v.emptySections.length > 0 ? ' · ' : null}
            {v.emptySections.length > 0
              ? `${c.detail.emptySections}: ${v.emptySections.join(', ')}`
              : null}
          </p>
        ) : null}

        {v.errors.length > 0 ? (
          <div className="acAnalysisErrorBox">
            <div className="acAnalysisErrorTitle">{c.detail.errors}</div>
            {v.errors.map((e) => (
              <div key={e} className="mcMono">
                {e}
              </div>
            ))}
          </div>
        ) : null}

        {v.answerText === null && v.phase !== 'in_progress' ? (
          <p className="mcMuted">{c.detail.noAnswerYet}</p>
        ) : null}

        {v.preamble ? <p className="acAnalysisPreamble">{v.preamble}</p> : null}

        {v.blocks.length > 0 ? (
          <div className="acAnalysisBlocks">
            {v.blocks.map((b, i) => (
              <section key={`${b.label}-${i}`} className={`acAnalysisBlock acAnalysisBlock${b.label}`}>
                <div className="acAnalysisBlockLabel">{c.sectionLabels[b.label] ?? b.label}</div>
                <div className="acAnalysisBlockBody">{b.content}</div>
              </section>
            ))}
          </div>
        ) : null}

        {v.answerText && v.blocks.length > 0 ? (
          <details className="acAnalysisRaw">
            <summary>{c.detail.rawAnswer}</summary>
            <pre>{v.answerText}</pre>
          </details>
        ) : null}

        {v.model || m ? (
          <dl className="acAnalysisMetrics">
            {v.model ? (
              <div>
                <dt>{c.detail.model}</dt>
                <dd className="mcMono">{v.model}</dd>
              </div>
            ) : null}
            {m?.tokensPerSecond != null ? (
              <div>
                <dt>{c.detail.speed}</dt>
                <dd className="mcMono">
                  {m.tokensPerSecond.toFixed(1)} {c.units.tokPerSec}
                </dd>
              </div>
            ) : null}
            {m && (m.promptTokens != null || m.completionTokens != null) ? (
              <div>
                <dt>{c.detail.tokens}</dt>
                <dd className="mcMono">
                  {m.promptTokens ?? '—'} / {m.completionTokens ?? '—'}
                </dd>
              </div>
            ) : null}
            {m?.totalDurationMs != null ? (
              <div>
                <dt>{c.detail.duration}</dt>
                <dd className="mcMono">
                  {(m.totalDurationMs / 1000).toFixed(1)} {c.units.sec}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </Panel>
    </>
  )
}
