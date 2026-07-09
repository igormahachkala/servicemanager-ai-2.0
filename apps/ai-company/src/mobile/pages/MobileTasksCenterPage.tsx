import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { MobileSection } from '../components/MobileSection'
import { MobileTaskCenterCard } from '../components/MobileTaskCenterCard'
import { MobileTaskCenterFilters } from '../components/MobileTaskCenterFilters'
import { useMobileTasksCenter } from '../hooks/useMobileTasksCenter'
import { MOBILE_PATHS } from '../navigation/mobileHrefResolver'

export function MobileTasksCenterPage() {
  const { t } = useI18n()
  const copy = t.mobile.tasksCenter
  const { filter, setFilter, snapshot, refresh } = useMobileTasksCenter('all')

  const showMaxQueue =
    (filter === 'all' || filter === 'queue' || filter === 'active') && snapshot.maxQueueItems.length > 0

  const maxQueueIds = new Set(snapshot.maxQueueItems.map((item) => item.id))
  const listItems = showMaxQueue
    ? snapshot.items.filter((item) => !maxQueueIds.has(item.id))
    : snapshot.items

  const isEmpty =
    !snapshot.activeTask && snapshot.items.length === 0 && snapshot.maxQueueItems.length === 0

  return (
    <div className="acMobilePage acMobileTasksCenterPage">
      <div className="acMobileTasksCenterIntro">
        <p className="acMobilePageIntro acMobileTasksCenterDescription">{copy.description}</p>
        <div className="acMobileTasksCenterIntroActions">
          <Link to={MOBILE_PATHS.tasksNewMax} className="acMobilePrimaryBtn acMobileTasksCenterAssignBtn">
            {copy.actions.assignTask}
          </Link>
          <Link to={MOBILE_PATHS.tasksHistory} className="acMobileSecondaryBtn">
            {copy.actions.openHistory}
          </Link>
          <button type="button" className="acMobileRefreshBtn" onClick={refresh}>
            {copy.refresh}
          </button>
        </div>
      </div>

      <div className="acMobileTaskCenterStats" aria-label={copy.statsAria}>
        <div className="acMobileTaskCenterStat">
          <span className="acMobileTaskCenterStatLabel">{copy.stats.pending}</span>
          <span className="acMobileTaskCenterStatValue">{snapshot.stats.pending}</span>
        </div>
        <div className="acMobileTaskCenterStat">
          <span className="acMobileTaskCenterStatLabel">{copy.stats.running}</span>
          <span className="acMobileTaskCenterStatValue">{snapshot.stats.running}</span>
        </div>
        <div className="acMobileTaskCenterStat">
          <span className="acMobileTaskCenterStatLabel">{copy.stats.completed}</span>
          <span className="acMobileTaskCenterStatValue">{snapshot.stats.completed}</span>
        </div>
        <div className="acMobileTaskCenterStat">
          <span className="acMobileTaskCenterStatLabel">{copy.stats.failed}</span>
          <span className="acMobileTaskCenterStatValue">{snapshot.stats.failed}</span>
        </div>
        <div className="acMobileTaskCenterStat">
          <span className="acMobileTaskCenterStatLabel">{copy.stats.blocked}</span>
          <span className="acMobileTaskCenterStatValue">{snapshot.stats.blocked}</span>
        </div>
      </div>

      <MobileTaskCenterFilters filter={filter} counts={snapshot.counts} onChange={setFilter} />

      {snapshot.activeTask ? (
        <MobileSection title={copy.sections.activeTask}>
          <MobileTaskCenterCard item={snapshot.activeTask} highlighted />
        </MobileSection>
      ) : null}

      {showMaxQueue ? (
        <MobileSection
          title={copy.sections.maxQueue}
          description={snapshot.maxSuggestedAction ?? copy.sections.maxQueueHint}
        >
          <div className="acMobileTaskCenterList">
            {snapshot.maxQueueItems.map((item) => (
              <MobileTaskCenterCard key={item.id} item={item} />
            ))}
          </div>
        </MobileSection>
      ) : null}

      {!isEmpty && listItems.length > 0 ? (
        <MobileSection title={copy.sections.list}>
          <div className="acMobileTaskCenterList">
            {listItems.map((item) => (
              <MobileTaskCenterCard key={item.id} item={item} />
            ))}
          </div>
        </MobileSection>
      ) : null}

      {isEmpty ? (
        <section className="acMobileTasksCenterEmpty" aria-label={copy.empty.title}>
          <h2 className="acMobileTasksCenterEmptyTitle">{copy.empty.title}</h2>
          <p className="acMobileTasksCenterEmptyDescription">{copy.empty.description}</p>
          <Link to={MOBILE_PATHS.standardTaskNewMax} className="acMobilePrimaryBtn acMobileTasksCenterEmptyCta">
            {copy.empty.standardTask}
          </Link>
          <Link to={MOBILE_PATHS.tasksNewMax} className="acMobileTertiaryLinkBtn acMobileTasksCenterEmptySecondary">
            {copy.empty.assignCustom}
          </Link>
        </section>
      ) : null}
    </div>
  )
}
