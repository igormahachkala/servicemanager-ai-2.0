import { MOBILE_HOME_TABS, MOBILE_HOME_TAB_LABELS, type MobileHomeBoardFilterTab } from '../mobileHomeBoardFilters'

const COLLAPSED_TABS: MobileHomeBoardFilterTab[] = ['all', 'mine', 'new']

type Props = {
  boardTab: MobileHomeBoardFilterTab
  setBoardTab: (tab: MobileHomeBoardFilterTab) => void
  tabCounts: Record<MobileHomeBoardFilterTab, number>
  collapsed?: boolean
  /** Активна быстрая карта → она единственный доминант, вкладки в нейтральном состоянии. */
  activeSuppressed?: boolean
}

export function HomeTabs(props: Props) {
  const { boardTab, setBoardTab, tabCounts, collapsed, activeSuppressed } = props
  const visibleTabs = collapsed ? COLLAPSED_TABS : MOBILE_HOME_TABS
  return (
    <div className="mobileFilterTabs mobileHomeStatusTabs" role="tablist" aria-label="Статус заявок">
      {visibleTabs.map((tab) => {
        const isActive = !activeSuppressed && boardTab === tab
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`mobileFilterTab${isActive ? ' mobileFilterTabActive' : ''}`}
            onClick={() => setBoardTab(tab)}
          >
            {MOBILE_HOME_TAB_LABELS[tab]}
            <span className="mobileFilterTabCount">{tabCounts[tab]}</span>
          </button>
        )
      })}
    </div>
  )
}
