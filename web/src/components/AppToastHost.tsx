import { useAppToasts } from '../lib/appToast'

/**
 * Renders all in-app toasts: simple action-feedback toasts and rich
 * notification toasts with click-through navigation.
 *
 * Replaces ToastViewport. Positioned fixed via .toastViewport CSS class;
 * on mobile (≤639px) lifted above the bottom nav bar automatically.
 */
export function AppToastHost() {
  const items = useAppToasts()
  if (items.length === 0) return null

  return (
    <div className="toastViewport" aria-live="polite">
      {items.map((t) =>
        t.onClick ? (
          <button
            key={t.id}
            type="button"
            className={`toastItem toastItem_${t.tone} toastItem--clickable`}
            onClick={t.onClick}
            aria-label={t.title}
          >
            <span className="toastItemTitle">{t.title}</span>
            {t.message ? <span className="toastItemBody">{t.message}</span> : null}
          </button>
        ) : (
          <div key={t.id} className={`toastItem toastItem_${t.tone}`} role="status">
            {t.title ? (
              <>
                <span className="toastItemTitle">{t.title}</span>
                {t.message ? <span className="toastItemBody">{t.message}</span> : null}
              </>
            ) : (
              t.message
            )}
          </div>
        ),
      )}
    </div>
  )
}
