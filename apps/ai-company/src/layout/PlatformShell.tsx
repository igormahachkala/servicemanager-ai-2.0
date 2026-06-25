import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { PresenceRouteBridge } from '../components/presence'
import { Sidebar } from './Sidebar'
import { StatusBar } from './StatusBar'
import { TopBar } from './TopBar'
import '../mission-control/styles/mission-control.css'
import '../mission-control/styles/company.css'

export function PlatformShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const closeSidebar = () => setSidebarOpen(false)

  return (
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
    </div>
  )
}
