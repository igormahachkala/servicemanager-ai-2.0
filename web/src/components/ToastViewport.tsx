import { useAppToasts } from '../lib/appToast'

export function ToastViewport() {
  const items = useAppToasts()
  if (items.length === 0) return null
  return (
    <div className="toastViewport" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toastItem toastItem_${t.tone}`} role="status">
          {t.message}
        </div>
      ))}
    </div>
  )
}
