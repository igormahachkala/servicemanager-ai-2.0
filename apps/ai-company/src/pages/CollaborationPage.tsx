import { useEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AgentConversation } from '../components/collaboration/AgentConversation'
import { CollaborationTimeline } from '../components/collaboration/CollaborationTimeline'
import { ConsensusCard } from '../components/collaboration/ConsensusCard'
import { DecisionPanel } from '../components/collaboration/DecisionPanel'
import { DiscussionGraph } from '../components/collaboration/DiscussionGraph'
import { COLLABORATION_STATUSES, getFinalDecision } from '../domain/collaboration/collaborationSession'
import type { CollaborationStatus } from '../domain/collaboration/collaborationSession'
import { useCollaboration } from '../hooks/useCollaboration'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { useI18n } from '../i18n'

export function CollaborationPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const { t } = useI18n()
  const { filtered, selected, stats, query, setQuery, filter, setFilter } = useCollaboration(id)

  useEffect(() => {
    const projectId = searchParams.get('project')
    if (projectId) {
      setFilter((current) => ({ ...current, projectId }))
    }
  }, [searchParams, setFilter])

  if (id && selected) {
    const finalDecision = getFinalDecision(selected)

    return (
      <div className="mcCollabPage">
        <div className="mcPageHeaderRow">
          <PageHeader
            title={selected.title}
            description={selected.goal}
          />
          <Link to="/ops/collaboration" className="mcBtn mcBtnSecondary">
            {t.collaborationEngine.backToList}
          </Link>
        </div>

        <div className="mcCollabDetailMeta mcMono mcMuted">
          {t.collaborationEngine.status[selected.status]} · {selected.participants.length}{' '}
          {t.collaborationEngine.participants.toLowerCase()} · {selected.messages.length}{' '}
          {t.collaborationEngine.messages.toLowerCase()}
        </div>

        <div className="mcCollabDetailGrid">
          <div className="mcCollabDetailMain">
            <CollaborationTimeline session={selected} />
            <AgentConversation messages={selected.messages} />
            <DecisionPanel decisions={selected.decisions} />
            <ConsensusCard decision={finalDecision} />
          </div>
          <div className="mcCollabDetailSide">
            <DiscussionGraph participants={selected.participants} messages={selected.messages} />
            <Panel title={t.collaborationEngine.sections.artifacts}>
              <div className="mcProfilePanelBody">
                {selected.artifacts.length === 0 ? (
                  <div className="mcCollabEmpty">{t.collaborationEngine.empty.artifacts}</div>
                ) : (
                  <ul className="mcCollabArtifactList">
                    {selected.artifacts.map((artifact) => (
                      <li key={artifact.id}>
                        {artifact.href ? (
                          <Link to={artifact.href} className="mcCollabArtifactLink">
                            {artifact.label}
                          </Link>
                        ) : (
                          <span>{artifact.label}</span>
                        )}
                        <span className="mcCollabArtifactKind">
                          {t.collaborationEngine.artifactKinds[artifact.kind]}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Panel>
            <Panel title={t.collaborationEngine.sections.participants}>
              <div className="mcProfilePanelBody">
                <ul className="mcCollabParticipantList">
                  {selected.participants.map((participant) => (
                    <li key={participant.employeeId}>
                      <Link to={`/ops/employees/${participant.employeeId}`}>{participant.codename}</Link>
                      <span className="mcMuted">{participant.role}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>
          </div>
        </div>

        <p className="mcCollabLocalNote">{t.collaborationEngine.localOnly}</p>
      </div>
    )
  }

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader
          title={t.pages.collaboration}
          description={t.collaborationEngine.pageDescription}
        />
        <Link to="/ops/chats" className="mcBtn mcBtnSecondary">
          {t.pages.chats}
        </Link>
        <Link to="/ops/timeline" className="mcBtn mcBtnSecondary">
          {t.pages.companyTimeline}
        </Link>
      </div>

      <div className="mcGrid4" style={{ marginBottom: 16 }}>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.collaborationEngine.stats.total}</div>
          <div className="mcMetricValue">{stats.total}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.collaborationEngine.stats.active}</div>
          <div className="mcMetricValue">{stats.active}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.collaborationEngine.stats.consensus}</div>
          <div className="mcMetricValue">{stats.consensus}</div>
        </div>
        <div className="mcMetric">
          <div className="mcMetricLabel">{t.collaborationEngine.stats.participants}</div>
          <div className="mcMetricValue">{stats.participants}</div>
        </div>
      </div>

      <Panel
        title={t.collaborationEngine.catalogTitle}
        right={
          <span className="mcMono mcMuted">
            {filtered.length} {t.collaborationEngine.sessionCount}
          </span>
        }
      >
        <div className="mcProfilePanelBody mcStack">
          <label className="mcField mcMemorySearch">
            <span className="mcFieldLabel">{t.collaborationEngine.searchLabel}</span>
            <input
              className="mcInput"
              type="search"
              value={query}
              placeholder={t.collaborationEngine.searchPlaceholder}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <label className="mcField">
            <span className="mcFieldLabel">{t.collaborationEngine.filters.status}</span>
            <select
              className="mcInput"
              value={filter.status ?? 'all'}
              onChange={(event) =>
                setFilter({
                  ...filter,
                  status: event.target.value as CollaborationStatus | 'all',
                })
              }
            >
              <option value="all">{t.common.all}</option>
              {COLLABORATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t.collaborationEngine.status[status]}
                </option>
              ))}
            </select>
          </label>

          {filtered.length === 0 ? (
            <div className="mcCollabEmpty">{t.collaborationEngine.empty.sessions}</div>
          ) : (
            <div className="mcCollabSessionList">
              {filtered.map((session) => (
                <Link
                  key={session.id}
                  to={`/ops/collaboration/${session.id}`}
                  className="mcCollabSessionCard"
                >
                  <div className="mcCollabSessionHead">
                    <span className="mcCollabSessionTitle">{session.title}</span>
                    <span className={`mcCollabSessionStatus mcCollabSessionStatus${session.status}`}>
                      {t.collaborationEngine.status[session.status]}
                    </span>
                  </div>
                  <p className="mcCollabSessionGoal">{session.goal}</p>
                  <div className="mcCollabSessionMeta mcMuted">
                    {session.participants.map((item) => item.codename).join(' · ')} ·{' '}
                    {session.messages.length} {t.collaborationEngine.messages.toLowerCase()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <p className="mcCollabFutureNote">{t.collaborationEngine.futureNote}</p>
      <p className="mcCollabLocalNote">{t.collaborationEngine.localOnly}</p>
    </>
  )
}
