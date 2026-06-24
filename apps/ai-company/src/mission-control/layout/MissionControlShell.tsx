import { Outlet, useLocation } from 'react-router-dom'
import { pageTitle, useI18n } from '../../i18n'
import '../styles/mission-control.css'

export function MissionControlShell() {
  const { pathname } = useLocation()
  const { t } = useI18n()
  const title = pageTitle(pathname, t)
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

  return (
    <div className="mcRoot" style={{ height: '100%', minHeight: 0 }}>
      <div className="mcLayout" style={{ minHeight: '100%' }}>
        <div className="mcMain" style={{ width: '100%' }}>
          <header className="mcTopbar">
            <span className="mcTopbarTitle">{title}</span>
            <span className="mcTopbarMeta">
              UTC {now}Z · {t.shell.mockTelemetry}
            </span>
          </header>
          <main className="mcContent">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
