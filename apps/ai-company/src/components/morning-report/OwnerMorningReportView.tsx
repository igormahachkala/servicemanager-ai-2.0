import { Link } from 'react-router-dom'
import type { OwnerMorningReportLine, OwnerMorningReportSnapshot } from '../../domain/morningReport'
import { useI18n } from '../../i18n'

type Props = {
  snapshot: OwnerMorningReportSnapshot
}

function formatTime(iso: string | null): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } catch {
    return null
  }
}

function ReportLineItem({ item }: { item: OwnerMorningReportLine }) {
  const time = formatTime(item.at)
  const content = (
    <>
      <div className="acMorningReportLineHead">
        <span className="acMorningReportLineTitle">{item.headline}</span>
        {item.badge ? <span className="acMorningReportBadge">{item.badge}</span> : null}
        {time ? <span className="acMorningReportLineTime">{time}</span> : null}
      </div>
      {item.detail ? <p className="acMorningReportLineDetail">{item.detail}</p> : null}
    </>
  )

  if (item.href) {
    return (
      <li className="acMorningReportLine">
        <Link to={item.href} className="acMorningReportLineLink">
          {content}
        </Link>
      </li>
    )
  }

  return <li className="acMorningReportLine">{content}</li>
}

function ReportSection({
  title,
  subtitle,
  items,
  emptyText,
  variant = 'default',
}: {
  title: string
  subtitle?: string
  items: OwnerMorningReportLine[]
  emptyText: string
  variant?: 'default' | 'attention' | 'next'
}) {
  return (
    <section className={`acMorningReportSection acMorningReportSection--${variant}`}>
      <header className="acMorningReportSectionHeader">
        <h2 className="acMorningReportSectionTitle">{title}</h2>
        {subtitle ? <p className="acMorningReportSectionSubtitle">{subtitle}</p> : null}
      </header>
      {items.length > 0 ? (
        <ul className="acMorningReportList">{items.map((item) => <ReportLineItem key={item.id} item={item} />)}</ul>
      ) : (
        <p className="acMorningReportEmpty">{emptyText}</p>
      )}
    </section>
  )
}

export function OwnerMorningReportView({ snapshot }: Props) {
  const { t } = useI18n()
  const mr = t.morningReport

  const doneItems = [...snapshot.whatMaxDid, ...snapshot.completedTasks]
  const discoveredItems = [...snapshot.whatMaxChecked, ...snapshot.whatDiscovered]

  return (
    <div className="acMorningReport">
      <header className="acMorningReportHero">
        <div className="acMorningReportHeroMain">
          <p className="acMorningReportGreeting">{mr.greeting}</p>
          <h1 className="acMorningReportTitle">{mr.title}</h1>
          <p className="acMorningReportEmployee">{snapshot.employeeLabel}</p>
          <p className="acMorningReportPeriod">{snapshot.periodLabel}</p>
          <p className="acMorningReportSummary">{snapshot.summary}</p>
        </div>
        <div className="acMorningReportHeroMeta">
          <span className="acMorningReportMetaLabel">{mr.generatedAt}</span>
          <span className="acMono">{new Date(snapshot.generatedAt).toLocaleString()}</span>
        </div>
      </header>

      <div className="acMorningReportStats" aria-label={mr.statsAria}>
        <div className="acMorningReportStat">
          <span className="acMorningReportStatValue">{snapshot.stats.loopsCompleted}</span>
          <span className="acMorningReportStatLabel">{mr.stats.loopsCompleted}</span>
        </div>
        <div className="acMorningReportStat">
          <span className="acMorningReportStatValue">{snapshot.stats.reportsCreated}</span>
          <span className="acMorningReportStatLabel">{mr.stats.reportsCreated}</span>
        </div>
        <div className="acMorningReportStat">
          <span className="acMorningReportStatValue">{snapshot.stats.pendingApprovals}</span>
          <span className="acMorningReportStatLabel">{mr.stats.pendingApprovals}</span>
        </div>
        <div className="acMorningReportStat">
          <span className="acMorningReportStatValue">{snapshot.stats.cursorTasksPending}</span>
          <span className="acMorningReportStatLabel">{mr.stats.cursorTasks}</span>
        </div>
        <div className="acMorningReportStat">
          <span className="acMorningReportStatValue">{snapshot.stats.memoryDrafts}</span>
          <span className="acMorningReportStatLabel">{mr.stats.memoryDrafts}</span>
        </div>
        <div className="acMorningReportStat">
          <span className="acMorningReportStatValue">{snapshot.stats.knowledgeCandidates}</span>
          <span className="acMorningReportStatLabel">{mr.stats.knowledgeCandidates}</span>
        </div>
      </div>

      <div className="acMorningReportBody">
        <ReportSection
          title={mr.sections.whatDone}
          subtitle={mr.sections.whatDoneHint}
          items={doneItems}
          emptyText={mr.empty.whatDone}
        />

        {snapshot.reportsCreated.length > 0 ? (
          <ReportSection
            title={mr.sections.reportsCreated}
            items={snapshot.reportsCreated}
            emptyText={mr.empty.reports}
          />
        ) : null}

        <ReportSection
          title={mr.sections.whatDiscovered}
          subtitle={mr.sections.whatDiscoveredHint}
          items={discoveredItems}
          emptyText={mr.empty.whatDiscovered}
        />

        {snapshot.memoryDrafts.length > 0 ? (
          <ReportSection
            title={mr.sections.memoryDrafts}
            items={snapshot.memoryDrafts}
            emptyText={mr.empty.memoryDrafts}
          />
        ) : null}

        {snapshot.knowledgeCandidates.length > 0 ? (
          <ReportSection
            title={mr.sections.knowledgeCandidates}
            items={snapshot.knowledgeCandidates}
            emptyText={mr.empty.knowledgeCandidates}
          />
        ) : null}

        <ReportSection
          title={mr.sections.needsOwner}
          subtitle={mr.sections.needsOwnerHint}
          items={snapshot.needsOwnerApproval}
          emptyText={mr.empty.needsOwner}
          variant="attention"
        />

        <ReportSection
          title={mr.sections.cursorTasks}
          subtitle={mr.sections.cursorTasksHint}
          items={snapshot.cursorTasks}
          emptyText={mr.empty.cursorTasks}
        />

        <section className="acMorningReportSection acMorningReportSection--next">
          <header className="acMorningReportSectionHeader">
            <h2 className="acMorningReportSectionTitle">{mr.sections.nextStep}</h2>
            <p className="acMorningReportSectionSubtitle">{mr.sections.nextStepHint}</p>
          </header>
          {snapshot.nextStep ? (
            <div className={`acMorningReportNext acMorningReportNext--${snapshot.nextStep.priority}`}>
              <div className="acMorningReportNextHeadline">{snapshot.nextStep.headline}</div>
              <p className="acMorningReportNextDetail">{snapshot.nextStep.detail}</p>
              {snapshot.nextStep.href ? (
                <Link to={snapshot.nextStep.href} className="mcBtn mcBtnPrimary acMorningReportNextAction">
                  {mr.openNextStep}
                </Link>
              ) : null}
            </div>
          ) : (
            <p className="acMorningReportEmpty">{mr.empty.nextStep}</p>
          )}
        </section>
      </div>

      <p className="mcMemoryLocalNote">{mr.localNote}</p>
    </div>
  )
}
