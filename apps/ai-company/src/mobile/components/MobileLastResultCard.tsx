import { Link } from 'react-router-dom'
import type { EmployeeDailyJournalEntry } from '../../domain/employeeDailyJournal'
import type { EmployeeOperatingDaySummary } from '../../domain/operatingDaySummary'
import { useI18n } from '../../i18n'
import { MOBILE_PATHS, resolveMobileHref } from '../navigation/mobileHrefResolver'
import { MobileCard } from './MobileCard'
import { MobileEmptyState } from './MobileEmptyState'

type Props = {
  lastJournalEntry: EmployeeDailyJournalEntry | null
  lastOperatingDaySummary: EmployeeOperatingDaySummary | null
  hasPriorActivity: boolean
  onStartWorkday: () => void
  lastResultCopy?: {
    title: string
    description: string
    readyHint: string
    startWorkday: string
    assignTask?: string
    fallbackTitle: string
    noSummary: string
    hasData: string
    model: string
    consultations: string
    recommendation: string
    openReport: string
    openReports: string
    openMorningReport?: string
  }
}

function formatWhen(iso: string): string {
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return iso
  return new Date(parsed).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MobileLastResultCard({
  lastJournalEntry,
  lastOperatingDaySummary,
  hasPriorActivity,
  onStartWorkday,
  lastResultCopy,
}: Props) {
  const { t } = useI18n()
  const copy = lastResultCopy ?? t.mobile.maxControl.lastResult

  if (!hasPriorActivity || (!lastJournalEntry && !lastOperatingDaySummary)) {
    return (
      <div className="acMobileMaxEmptyResult">
        <MobileEmptyState variant="workdayNotStarted" />
        <p className="acMobileMaxEmptyResultHint">{copy.readyHint}</p>
        <div className="acMobileCardActions acMobileMaxEmptyResultActions acMobileCardActionsPrimaryOnly">
          <button type="button" className="acMobilePrimaryBtn acMobileCardPrimaryWide" onClick={onStartWorkday}>
            {copy.startWorkday}
          </button>
        </div>
      </div>
    )
  }

  const title =
    lastJournalEntry?.taskTitle?.trim() ||
    lastJournalEntry?.taskText.slice(0, 80) ||
    lastOperatingDaySummary?.tasksCompleted[0]?.title ||
    copy.fallbackTitle

  const summary =
    lastJournalEntry?.resultSummary ||
    lastJournalEntry?.workSummary ||
    lastOperatingDaySummary?.nextDayRecommendations[0] ||
    copy.noSummary

  const finishedAt =
    lastJournalEntry?.finishedAt ||
    lastOperatingDaySummary?.finishedAt ||
    null

  const modelLabel =
    lastJournalEntry?.modelsUsed[0]?.label ||
    lastOperatingDaySummary?.modelsUsed[0]?.label ||
    null

  const consultationsCount =
    lastJournalEntry?.consultations.length ??
    lastOperatingDaySummary?.consultationCount ??
    0

  const recommendation =
    lastOperatingDaySummary?.nextDayRecommendations[0] ||
    lastJournalEntry?.decisions[0]?.summary ||
    null

  const reportHref =
    lastJournalEntry?.reportLinks[0]?.href ??
    lastOperatingDaySummary?.reportsCreated[0]?.href ??
    null

  return (
    <MobileCard title={copy.title} description={copy.description} status={{ label: copy.hasData, tone: 'success' }}>
      <div className="acMobileMaxResultHead">
        <h3 className="acMobileMaxResultTask">{title}</h3>
        {finishedAt ? <time className="acMobileMaxResultTime">{formatWhen(finishedAt)}</time> : null}
      </div>
      <p className="acMobileMaxResultSummary">{summary}</p>

      <dl className="acMobileMaxResultMeta">
        {modelLabel ? (
          <div className="acMobileMaxResultRow">
            <dt>{copy.model}</dt>
            <dd>{modelLabel}</dd>
          </div>
        ) : null}
        <div className="acMobileMaxResultRow">
          <dt>{copy.consultations}</dt>
          <dd>{consultationsCount}</dd>
        </div>
        {recommendation ? (
          <div className="acMobileMaxResultRow">
            <dt>{copy.recommendation}</dt>
            <dd>{recommendation}</dd>
          </div>
        ) : null}
      </dl>

      <div className="acMobileCardActions acMobileCardActionsSecondaryRow">
        {reportHref ? (
          <Link to={resolveMobileHref(reportHref)} className="acMobileSecondaryBtn">
            {copy.openReport}
          </Link>
        ) : null}
        <Link to={MOBILE_PATHS.reports} className="acMobileTertiaryLinkBtn">
          {copy.openReports}
        </Link>
      </div>
    </MobileCard>
  )
}
