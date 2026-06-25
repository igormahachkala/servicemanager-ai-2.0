import { useI18n } from '../i18n'

export function StatusBar() {
  const { t } = useI18n()
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

  return (
    <footer className="acStatusBar" aria-label={t.shell.statusBar}>
      <div className="acStatusBarLeft">
        <span className="acDot acDotGreen" aria-hidden />
        <span>{t.shell.platformReady}</span>
        <span>{t.shell.mockTelemetry}</span>
      </div>
      <div className="acStatusBarRight">
        <span>UTC {now}Z</span>
        <span className="acEnvPill">{t.brand.env}</span>
      </div>
    </footer>
  )
}
