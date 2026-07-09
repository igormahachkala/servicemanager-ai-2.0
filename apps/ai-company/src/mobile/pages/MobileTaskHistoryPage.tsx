import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { MobileTaskHistoryGroupCard } from '../components/MobileTaskHistoryGroupCard'
import { MobileTaskHistoryItemCard } from '../components/MobileTaskHistoryItemCard'
import { MobileSection } from '../components/MobileSection'
import { useMobileTaskHistory } from '../hooks/useMobileTaskHistory'
import { MOBILE_TASK_HISTORY_GROUP_IDS } from '../history/mobileTaskHistoryTypes'
import { MOBILE_PATHS, mobileTaskHistoryGroupHref } from '../navigation/mobileHrefResolver'

export function MobileTaskHistoryPage() {
  const { t } = useI18n()
  const copy = t.mobile.taskHistory
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const groupParam = searchParams.get('group')
  const { snapshot, activeGroup, refresh } = useMobileTaskHistory(groupParam)

  const nonEmptyGroups = snapshot.groups.filter((group) => group.totalCount > 0)

  return (
    <div className="acMobilePage acMobileTaskHistoryPage">
      <div className="acMobileTaskHistoryIntro">
        <p className="acMobilePageIntro">{copy.intro}</p>
        <button type="button" className="acMobileRefreshBtn" onClick={refresh}>
          {copy.refresh}
        </button>
      </div>

      {activeGroup ? (
        <>
          <div className="acMobileTaskHistoryActiveHead">
            <button
              type="button"
              className="acMobileTertiaryLinkBtn"
              onClick={() => navigate(MOBILE_PATHS.tasksHistory)}
            >
              {copy.actions.backToGroups}
            </button>
            <h2 className="acMobileTaskHistoryActiveTitle">{copy.groups[activeGroup.id]}</h2>
          </div>

          <MobileTaskHistoryGroupCard group={activeGroup} expanded />

          <MobileSection title={copy.sections.items} description={copy.sections.itemsHint}>
            <div className="acMobileTaskHistoryItemList">
              {activeGroup.items.map((item) => (
                <MobileTaskHistoryItemCard key={item.id} item={item} />
              ))}
            </div>
          </MobileSection>
        </>
      ) : (
        <>
          {snapshot.isEmpty ? (
            <section className="acMobileTaskHistoryEmpty" aria-label={copy.empty.title}>
              <h2 className="acMobileTaskHistoryEmptyTitle">{copy.empty.title}</h2>
              <p className="acMobileTaskHistoryEmptyDescription">{copy.empty.description}</p>
              <Link to={MOBILE_PATHS.tasksNewMax} className="acMobilePrimaryBtn">
                {copy.empty.action}
              </Link>
            </section>
          ) : null}

          <MobileSection title={copy.sections.groups} description={copy.sections.groupsHint}>
            <div className="acMobileTaskHistoryGroupList">
              {MOBILE_TASK_HISTORY_GROUP_IDS.map((groupId) => {
                const group = snapshot.groups.find((entry) => entry.id === groupId)
                if (!group) return null
                return <MobileTaskHistoryGroupCard key={group.id} group={group} />
              })}
            </div>
          </MobileSection>

          {nonEmptyGroups.length > 0 ? (
            <MobileSection title={copy.sections.quickLinks}>
              <nav className="acMobileTaskHistoryQuickLinks" aria-label={copy.sections.quickLinks}>
                {nonEmptyGroups.map((group) => (
                  <Link
                    key={group.id}
                    to={mobileTaskHistoryGroupHref(group.id)}
                    className="acMobileSecondaryBtn acMobileTaskHistoryQuickLink"
                  >
                    {copy.groups[group.id]} ({group.totalCount})
                  </Link>
                ))}
              </nav>
            </MobileSection>
          ) : null}
        </>
      )}

      <p className="acMobileTaskHistoryLocalNote">{copy.localNote}</p>
    </div>
  )
}
