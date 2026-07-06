import { Link } from 'react-router-dom'
import type { CommandCenterMorningBrief } from '../../domain/commandCenter'
import { useI18n } from '../../i18n'

type Props = {
  brief: CommandCenterMorningBrief
  healthScore: number
}

export function MorningBrief({ brief, healthScore }: Props) {
  const { t } = useI18n()
  const cc = t.commandCenter

  const greeting = cc.greeting[brief.timeOfDay]
  const highlights: string[] = []

  if (brief.employeesWorking > 0) {
    highlights.push(
      cc.brief.workingHighlight.replace('{count}', String(brief.employeesWorking)),
    )
  }
  if (brief.pendingApprovals > 0) {
    highlights.push(
      cc.brief.approvalsHighlight.replace('{count}', String(brief.pendingApprovals)),
    )
  }
  if (brief.sprintHealth) {
    highlights.push(cc.brief.sprintHighlight.replace('{health}', cc.sprintHealth[brief.sprintHealth]))
  }
  if (brief.controlRoomProgress !== null) {
    highlights.push(
      cc.brief.projectHighlight.replace('{progress}', String(brief.controlRoomProgress)),
    )
  }
  if (highlights.length === 0) {
    highlights.push(cc.brief.calmDay)
  }

  const riskNote =
    brief.criticalAlerts > 0
      ? cc.brief.riskAlerts.replace('{count}', String(brief.criticalAlerts))
      : brief.employeesWaiting > 0
        ? cc.brief.riskWaiting.replace('{count}', String(brief.employeesWaiting))
        : null

  return (
    <section className="mcCommandCenterBrief">
      <div className="mcCommandCenterBriefMain">
        <div className="mcCommandCenterBriefGreeting">{greeting}</div>
        <p className="mcCommandCenterBriefSummary">{cc.brief.summary}</p>
        <ul className="mcCommandCenterBriefList">
          {highlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {riskNote ? <div className="mcCommandCenterBriefRisk">{riskNote}</div> : null}
      </div>
      <div className="mcCommandCenterBriefScore">
        <span className="mcCommandCenterBriefScoreLabel">{cc.brief.healthScore}</span>
        <span className="mcCommandCenterBriefScoreValue">{healthScore}</span>
        <span className="mcCommandCenterBriefScoreMeta">
          {brief.unreadNotifications > 0
            ? cc.brief.unread.replace('{count}', String(brief.unreadNotifications))
            : cc.brief.allClear}
        </span>
        <Link to="/ops/morning-report" className="mcLink mcCommandCenterBriefLink">
          {t.morningReport.pageTitle}
        </Link>
        <Link to="/ops/day" className="mcLink mcCommandCenterBriefLink">
          {t.operatingDayEngine.title}
        </Link>
        <Link to="/ops/timeline" className="mcLink mcCommandCenterBriefLink">
          {cc.brief.openTimeline}
        </Link>
      </div>
    </section>
  )
}
