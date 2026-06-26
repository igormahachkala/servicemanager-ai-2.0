import type { VisualLabBrowserState, VisualLabScreenshot } from '../../domain/visualLab'
import { useI18n } from '../../i18n'

type Props = {
  browser: VisualLabBrowserState
  screenshots: VisualLabScreenshot[]
}

export function VisualLabBrowserPreview({ browser, screenshots }: Props) {
  const { t } = useI18n()

  return (
    <section className="vlBrowserPanel">
      <div className="vlPanelHeader">{t.visualLab.browser.title}</div>

      <div className="vlBrowserChrome">
        <div className="vlBrowserDots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <div className="vlBrowserUrl acMono">{browser.url}</div>
      </div>

      <div className="vlBrowserViewport">
        <div className="vlBrowserPage">
          <div className="vlBrowserPageTitle">{browser.title}</div>
          <p className="vlBrowserPageCopy">{t.visualLab.browser.landingCopy}</p>

          <div className="vlBrowserForm">
            <label className="vlBrowserLabel" htmlFor="vl-login-email">
              Email
            </label>
            <div
              className={`vlBrowserInput ${browser.highlights.some((item) => item.id === 'hl-email') ? 'vlBrowserInputHighlight' : ''}`}
              id="vl-login-email"
            >
              owner@company.local
            </div>

            {browser.showLoginButton ? (
              <button
                type="button"
                className={`vlBrowserButton ${browser.highlights.some((item) => item.id === 'hl-submit') ? 'vlBrowserButtonHighlight' : ''}`}
              >
                {browser.loginButtonLabel}
              </button>
            ) : (
              <div className="vlBrowserButtonPlaceholder">{t.visualLab.browser.buttonPending}</div>
            )}
          </div>

          {browser.highlights.map((item) => (
            <div
              key={item.id}
              className="vlBrowserHighlight"
              style={{
                top: item.top,
                left: item.left,
                width: item.width,
                height: item.height,
              }}
            >
              <span className="vlBrowserHighlightLabel">{item.label}</span>
            </div>
          ))}

          {browser.clicks.map((click) => (
            <span
              key={click.id}
              className="vlBrowserClickRipple"
              style={{ top: click.y, left: click.x }}
              title={click.target}
            />
          ))}

          {browser.cursor ? (
            <div
              className="vlBrowserCursor"
              style={{ top: browser.cursor.y, left: browser.cursor.x }}
              aria-hidden
            />
          ) : null}
        </div>
      </div>

      {screenshots.length > 0 ? (
        <div className="vlScreenshotStrip">
          <div className="vlScreenshotStripTitle">{t.visualLab.browser.screenshots}</div>
          <div className="vlScreenshotList">
            {screenshots.map((shot) => (
              <div key={shot.id} className="vlScreenshotCard">
                <div className="vlScreenshotThumb" />
                <div className="vlScreenshotLabel">{shot.label}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
