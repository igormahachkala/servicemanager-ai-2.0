import { Breadcrumbs } from './Breadcrumbs'
import { HelpCenterButton } from '../components/guided/HelpCenterButton'
import { ThemeSwitch } from '../components/theme'
import { LanguageToggle } from './LanguageToggle'
import { NotificationCenter } from '../components/notifications/NotificationCenter'
import { QuickActions } from './QuickActions'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'
import { useI18n } from '../i18n'

type TopBarProps = {
  onMenuToggle: () => void
}

export function TopBar({ onMenuToggle }: TopBarProps) {
  const { t } = useI18n()

  return (
    <header className="acTopBar" aria-label={t.aria.topNav}>
      <button
        type="button"
        className="acTopBarMenuBtn"
        aria-label={t.shell.toggleNav}
        onClick={onMenuToggle}
      >
        ☰
      </button>

      <div className="acTopBarBrand">
        <div className="acTopBarBrandMark" aria-hidden />
        <div>
          <div className="acTopBarBrandTitle">{t.brand.title}</div>
          <div className="acTopBarBrandSub">{t.brand.subtitle}</div>
        </div>
      </div>

      <Breadcrumbs />

      <div className="acTopBarSpacer" />

      <WorkspaceSwitcher />
      <QuickActions />

      <div className="acTopBarActions">
        <ThemeSwitch />
        <HelpCenterButton />
        <NotificationCenter />
        <LanguageToggle />
      </div>
    </header>
  )
}
