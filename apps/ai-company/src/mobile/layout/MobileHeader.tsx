import type { ReactNode } from 'react'
import { ThemeSwitch } from '../../components/theme/ThemeSwitch'
import { NotificationBadge } from '../../components/notifications/NotificationBadge'
import { useNotifications } from '../../hooks/useNotifications'
import { useI18n } from '../../i18n'
import { useMobileBottomSheet } from '../hooks/useMobileBottomSheet'
import { MobileActionSheet } from '../patterns/MobileActionSheet'
import { NotificationInbox } from '../../components/notifications/NotificationInbox'

type MobileHeaderProps = {
  title: string
  searchSlot?: ReactNode
  showSearch?: boolean
}

export function MobileHeader({ title, searchSlot, showSearch = false }: MobileHeaderProps) {
  const { t } = useI18n()
  const { unread, unreadCount, markRead, markAllRead } = useNotifications()
  const { openSheet, closeSheet } = useMobileBottomSheet()

  function openNotificationsSheet() {
    openSheet(
      <NotificationInbox
        items={unread.slice(0, 12)}
        onMarkRead={markRead}
        onMarkAllRead={markAllRead}
        emptyMessage={t.notificationEngine.emptyInbox}
      />,
      { title: t.notificationEngine.inboxTitle, ariaLabel: t.mobile.header.notifications },
    )
  }

  function openProfileSheet() {
    openSheet(
      <MobileActionSheet
        items={[
          {
            id: 'desktop',
            label: t.mobile.more.desktop,
            onSelect: () => {
              closeSheet()
              window.location.assign('/ops')
            },
          },
          {
            id: 'settings',
            label: t.mobile.more.settings,
            onSelect: closeSheet,
          },
        ]}
      />,
      { title: t.mobile.header.profile, ariaLabel: t.mobile.header.profile },
    )
  }

  return (
    <header className="acMobileHeader">
      <div className="acMobileHeaderMain">
        <h1 className="acMobileHeaderTitle">{title}</h1>
        <div className="acMobileHeaderActions">
          {showSearch ? (
            <button type="button" className="acMobileHeaderBtn" aria-label={t.mobile.header.openSearch}>
              <svg viewBox="0 0 24 24" aria-hidden className="acMobileHeaderIcon">
                <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="1.75" />
                <path d="M16 16l4 4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
          <button
            type="button"
            className="acMobileHeaderBtn"
            aria-label={t.mobile.header.notifications}
            onClick={openNotificationsSheet}
          >
            <svg viewBox="0 0 24 24" aria-hidden className="acMobileHeaderIcon">
              <path
                d="M12 4a5 5 0 00-5 5v3l-1.5 2.5h13L17 12V9a5 5 0 00-5-5z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
              <path d="M10 18a2 2 0 004 0" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
            <NotificationBadge count={unreadCount} compact />
          </button>
          <button
            type="button"
            className="acMobileHeaderBtn"
            aria-label={t.mobile.header.profile}
            onClick={openProfileSheet}
          >
            <svg viewBox="0 0 24 24" aria-hidden className="acMobileHeaderIcon">
              <circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
              <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
          <div className="acMobileHeaderTheme">
            <ThemeSwitch />
          </div>
        </div>
      </div>
      {searchSlot ? <div className="acMobileHeaderSearch">{searchSlot}</div> : null}
    </header>
  )
}
