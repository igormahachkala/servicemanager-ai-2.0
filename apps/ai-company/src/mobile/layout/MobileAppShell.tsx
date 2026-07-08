import { useCallback, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { useMobileBottomSheet } from '../hooks/useMobileBottomSheet'
import { MOBILE_PATHS } from '../navigation/mobileHrefResolver'
import { MobileBottomNavigation } from '../navigation/MobileBottomNavigation'
import { mobilePageTitle } from '../navigation/mobileNavigationConfig'
import { MobileFab } from '../components/MobileFab'
import { MobileActionSheet } from '../patterns/MobileActionSheet'
import { MobileFirstLaunchGuideHost } from '../components/MobileFirstLaunchGuideHost'
import { MobileDemoHelperHost } from '../components/MobileDemoHelperHost'
import { MobileBottomSheetHost } from '../patterns/MobileBottomSheetHost'
import {
  MobileFirstLaunchGuideProvider,
} from '../hooks/useMobileFirstLaunchGuide'
import { MobileContent } from './MobileContent'
import { MobileHeader } from './MobileHeader'

type MobileAppShellProps = {
  children: ReactNode
  title?: string
  searchSlot?: ReactNode
  showSearch?: boolean
  showFab?: boolean
  showBottomNav?: boolean
  contentPadded?: boolean
}

function MobileAppShellInner({
  children,
  title,
  searchSlot,
  showSearch = false,
  showFab = true,
  showBottomNav = true,
  contentPadded = true,
}: MobileAppShellProps) {
  const { t } = useI18n()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { openSheet, closeSheet } = useMobileBottomSheet()

  const resolvedTitle =
    title ??
    mobilePageTitle(
      pathname,
      {
        today: t.mobile.pages.today,
        employees: t.mobile.pages.employees,
        tasks: t.mobile.pages.tasks,
        decisions: t.mobile.pages.decisions,
        more: t.mobile.pages.more,
        runTaskNew: t.mobile.runTask.pageTitle,
        reports: t.mobile.reports.pageTitle,
        reportDetail: t.mobile.reports.detail.pageTitle,
        runtimeLive: t.mobile.runtimeLive.pageTitle,
        demo: t.mobile.demo.pageTitle,
      },
      t.mobile.maxControl.pageTitle ?? 'MAX',
    )

  const hideFab =
    pathname.startsWith('/mobile/tasks/new') ||
    pathname.startsWith('/mobile/runtime') ||
    pathname.startsWith('/mobile/demo')

  const openAssignTaskSheet = useCallback(() => {
    openSheet(
      <MobileActionSheet
        items={[
          {
            id: 'mobile-run-task',
            label: t.mobile.fab.assignTask,
            description: t.mobile.assignTaskSheet.description,
            onSelect: () => {
              closeSheet()
              navigate(MOBILE_PATHS.tasksNewMax)
            },
          },
          {
            id: 'morning-report',
            label: t.mobile.assignTaskSheet.morningReport,
            onSelect: () => {
              closeSheet()
              navigate(MOBILE_PATHS.morningReport)
            },
          },
        ]}
      />,
      { title: t.mobile.assignTaskSheet.title, ariaLabel: t.mobile.fab.ariaLabel },
    )
  }, [closeSheet, navigate, openSheet, t])

  return (
    <div className="acMobileShell" aria-label={t.mobile.shell.ariaLabel}>
      <div className="acMobileSafeAreaTop" aria-hidden />
      <MobileHeader title={resolvedTitle} searchSlot={searchSlot} showSearch={showSearch} />
      <MobileContent padded={contentPadded} fabVisible={showFab && !hideFab}>
        {children}
      </MobileContent>
      {showFab && !hideFab ? (
        <div className="acMobileFabHost">
          <MobileFab label={t.mobile.fab.assignTask} onClick={openAssignTaskSheet} />
        </div>
      ) : null}
      {showBottomNav ? <MobileBottomNavigation /> : null}
      <MobileDemoHelperHost />
      <div className="acMobileSafeAreaBottom" aria-hidden />
    </div>
  )
}

export function MobileAppShell(props: MobileAppShellProps) {
  return (
    <MobileBottomSheetHost>
      <MobileFirstLaunchGuideProvider>
        <MobileFirstLaunchGuideHost />
        <MobileAppShellInner {...props} />
      </MobileFirstLaunchGuideProvider>
    </MobileBottomSheetHost>
  )
}
