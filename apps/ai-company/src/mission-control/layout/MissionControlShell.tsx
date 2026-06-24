import { Outlet, useLocation } from 'react-router-dom'
import '../styles/mission-control.css'

const PAGE_TITLES: Record<string, string> = {
  '/ops': 'Mission Control',
  '/ops/organization': 'Organization',
  '/ops/employees': 'Employees',
  '/ops/tasks': 'Tasks',
  '/ops/feed': 'Mission Feed',
  '/ops/tools': 'AI Tools Registry',
}

export function MissionControlShell() {
  const { pathname } = useLocation()
  const title = PAGE_TITLES[pathname] ?? 'Mission Control'
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

  return (
    <div className="mcRoot" style={{ height: '100%', minHeight: 0 }}>
      <div className="mcLayout" style={{ minHeight: '100%' }}>
        <div className="mcMain" style={{ width: '100%' }}>
          <header className="mcTopbar">
            <span className="mcTopbarTitle">{title}</span>
            <span className="mcTopbarMeta">UTC {now}Z · mock telemetry</span>
          </header>
          <main className="mcContent">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
