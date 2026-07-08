import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { HelpCenterPanel } from '../components/guided/HelpCenterPanel'
import { PresenceRouteBridge } from '../components/presence'
import { HelpCenterProvider } from '../hooks/useHelpCenter'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { Sidebar } from './Sidebar'
import { StatusBar } from './StatusBar'
import { TopBar } from './TopBar'
import '../mission-control/styles/mission-control.css'
import '../mission-control/styles/company.css'
import '../styles/polish-v2.css'

export function PlatformShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useDocumentTitle()

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <HelpCenterProvider>
      <div className="acPlatform">
        {sidebarOpen ? (
          <button
            type="button"
            className="acPlatformOverlay"
            aria-label="Close navigation"
            onClick={closeSidebar}
          />
        ) : null}

        <Sidebar open={sidebarOpen} onNavigate={closeSidebar} />

        <div className="acPlatformMain">
          <TopBar onMenuToggle={() => setSidebarOpen((value) => !value)} />
          <PresenceRouteBridge />
          <main className="acPlatformContent">
            <Outlet />
          </main>
          <StatusBar />
        </div>

        <HelpCenterPanel />
      </div>
    </HelpCenterProvider>
  )
}
