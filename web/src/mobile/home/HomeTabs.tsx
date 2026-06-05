import * as api from '../../lib/api'
import { MobileHomeTabsIntroBanner, MobileTechnicianFirstStepsCard, dismissMobileHomeIntro } from '../MobileUxHints'
import { MOBILE_HOME_TABS, MOBILE_HOME_TAB_LABELS, type MobileHomeBoardFilterTab } from '../mobileHomeBoardFilters'

const COLLAPSED_TABS: MobileHomeBoardFilterTab[] = ['all', 'mine', 'new']

type Props = {
  role: api.Role | undefined
  boardTab: MobileHomeBoardFilterTab
  setBoardTab: (tab: MobileHomeBoardFilterTab) => void
  tabCounts: Record<MobileHomeBoardFilterTab, number>
  homeIntroDismissed: boolean
  setHomeIntroDismissed: (value: boolean) => void
  collapsed?: boolean
}

export function HomeTabs(props: Props) {
  const { role, boardTab, setBoardTab, tabCounts, homeIntroDismissed, setHomeIntroDismissed, collapsed } = props
  const visibleTabs = collapsed ? COLLAPSED_TABS : MOBILE_HOME_TABS
  return (
    <>
      <div className="mobileFilterTabs mobileHomeStatusTabs" role="tablist" aria-label="Статус заявок">
        {visibleTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={boardTab === tab}
            className={`mobileFilterTab${boardTab === tab ? ' mobileFilterTabActive' : ''}`}
            onClick={() => setBoardTab(tab)}
          >
            {MOBILE_HOME_TAB_LABELS[tab]}
            <span className="mobileFilterTabCount">{tabCounts[tab]}</span>
          </button>
        ))}
      </div>
      {role === 'TECHNICIAN' && !homeIntroDismissed ? (
        <MobileHomeTabsIntroBanner
          role={role}
          onDismiss={() => {
            dismissMobileHomeIntro()
            setHomeIntroDismissed(true)
          }}
        />
      ) : null}
      {role === 'TECHNICIAN' && tabCounts.mine === 0 ? <MobileTechnicianFirstStepsCard show /> : null}
      {role !== 'TECHNICIAN' ? (
        <div className="mobilePageHint">
          Все · Мои · Новые · В работе · Просроченные (SLA) · Завершенные.
        </div>
      ) : homeIntroDismissed ? (
        <div className="mobilePageHint">Фильтры: все · назначенные на вас · новые · в работе · просроченные · завершённые.</div>
      ) : null}
    </>
  )
}
