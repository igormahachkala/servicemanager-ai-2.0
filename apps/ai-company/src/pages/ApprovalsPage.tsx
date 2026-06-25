import { Link } from 'react-router-dom'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { ApprovalCard } from '../components/approval/ApprovalCard'
import { ApprovalFilters } from '../components/approval/ApprovalFilters'
import { ApprovalPolicyBadge } from '../components/approval/ApprovalPolicyBadge'
import { ApprovalSummary } from '../components/approval/ApprovalSummary'
import { useApprovals } from '../hooks/useApprovals'
import { useI18n } from '../i18n'

export function ApprovalsPage() {
  const { t } = useI18n()
  const { filtered, stats, policies, query, setQuery, filter, setFilter } = useApprovals()

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader title={t.pages.approvals} description={t.approvalEngine.pageDescription} />
        <Link to="/ops/notifications?type=approval" className="mcBtn mcBtnSecondary">
          {t.notificationEngine.approvalInbox}
        </Link>
        <Link to="/ops/audit" className="mcBtn mcBtnSecondary">
          {t.approvalEngine.openAudit}
        </Link>
        <Link to="/ops/tool-executions" className="mcBtn mcBtnSecondary">
          {t.pages.toolExecutions}
        </Link>
      </div>

      <ApprovalSummary stats={stats} />

      <div style={{ marginTop: 16 }}>
        <Panel
          title={t.approvalEngine.queueTitle}
          right={
            <span className="mcMono mcMuted">
              {filtered.length} {t.approvalEngine.requestCount}
            </span>
          }
        >
          <div className="mcProfilePanelBody mcStack">
            <label className="mcField mcMemorySearch">
              <span className="mcFieldLabel">{t.approvalEngine.searchLabel}</span>
              <input
                className="mcInput"
                type="search"
                value={query}
                placeholder={t.approvalEngine.searchPlaceholder}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <ApprovalFilters filter={filter} onChange={setFilter} />
            {filtered.length === 0 ? (
              <div className="mcApprovalEmpty">
                <div className="mcApprovalEmptyTitle">{t.approvalEngine.emptyListTitle}</div>
                <p className="mcApprovalEmptyDesc">{t.approvalEngine.emptyListDescription}</p>
              </div>
            ) : (
              <div className="mcApprovalCardGrid">
                {filtered.map((approval) => (
                  <ApprovalCard key={approval.id} approval={approval} />
                ))}
              </div>
            )}
          </div>
        </Panel>
      </div>

      <div style={{ marginTop: 16 }}>
        <Panel title={t.approvalEngine.policiesTitle}>
          <div className="mcApprovalPolicyGrid">
            {policies.map((policy) => (
              <div key={policy.id} className="mcApprovalPolicyCard">
                <div className="mcApprovalPolicyCardHead">
                  <span className="mcApprovalPolicyCardLabel">{policy.label}</span>
                  <ApprovalPolicyBadge rule={policy.rule} />
                </div>
                <p className="mcApprovalPolicyCardDesc mcMuted">{policy.description}</p>
                <span className="mcMono mcMuted">{t.approvalEngine.actionTypes[policy.actionType]}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div style={{ marginTop: 16 }}>
        <Panel title={t.approvalEngine.futureIntegrationTitle}>
          <div className="mcApprovalFutureGrid">
            {t.approvalEngine.futureIntegrations.map((item) => (
              <div key={item} className="mcApprovalFutureCard">
                <span className="mcApprovalFutureBadge">{t.approvalEngine.futureBadge}</span>
                <div className="mcApprovalFutureTitle">{item}</div>
                <p className="mcApprovalFutureDesc mcMuted">{t.approvalEngine.futureIntegrationHint}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <p className="mcReportPrincipleNote">{t.approvalEngine.principleNote}</p>
      <p className="mcMemoryLocalNote">{t.approvalEngine.localOnly}</p>
    </>
  )
}
