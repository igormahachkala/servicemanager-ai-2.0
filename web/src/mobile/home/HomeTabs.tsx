import * as api from '../../lib/api'
import { MobileHomeTabsIntroBanner, MobileTechnicianFirstStepsCard, dismissMobileHomeIntro } from '../MobileUxHints'
import { type MobileHomeBoardFilterTab } from '../mobileHomeBoardFilters'

const MOBILE_HOME_TAB_LABELS: Record<MobileHomeBoardFilterTab, string> = {
  all: 'Все',
  mine: 'Мои',
  in_work: 'В работе',
}

const MOBILE_HOME_TABS: MobileHomeBoardFilterTab[] = ['all', 'mine', 'in_work']

type Props = {
  role: api.Role | undefined
  boardTab: MobileHomeBoardFilterTab
  setBoardTab: (tab: MobileHomeBoardFilterTab) => void
  tabCounts: Record<MobileHomeBoardFilterTab, number>
  homeIntroDismissed: boolean
  setHomeIntroDismissed: (value: boolean) => void
}

export function HomeTabs(props: Props) {
  const { role, boardTab, setBoardTab, tabCounts, homeIntroDismissed, setHomeIntroDismissed } = props
  return (
    <>
      <div className="mobileFilterTabs mobileHomeStatusTabs" role="tablist" aria-label="Статус заявок">
        {MOBILE_HOME_TABS.map((tab) => (
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
          Все — полный список. Мои — рабочий список текущего контура. В работе — назначенные и в активной работе.
        </div>
      ) : homeIntroDismissed ? (
        <div className="mobilePageHint">Вкладки: все заявки · назначенные на вас · в работе по контуру.</div>
      ) : null}
    </>
  )
}
