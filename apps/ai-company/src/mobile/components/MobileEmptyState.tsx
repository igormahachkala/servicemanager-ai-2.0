import { useI18n } from '../../i18n'

export type MobileEmptyStateVariant =
  | 'noEmployees'
  | 'noTasks'
  | 'workdayNotStarted'
  | 'noReports'

type MobileEmptyStateProps = {
  variant: MobileEmptyStateVariant
  actionLabel?: string
  onAction?: () => void
}

export function MobileEmptyState({ variant, actionLabel, onAction }: MobileEmptyStateProps) {
  const { t } = useI18n()
  const copy = t.mobile.empty[variant]

  return (
    <div className="acMobileEmptyState">
      <div className="acMobileEmptyStateIcon" aria-hidden>
        <EmptyIcon variant={variant} />
      </div>
      <h3 className="acMobileEmptyStateTitle">{copy.title}</h3>
      <p className="acMobileEmptyStateDescription">{copy.description}</p>
      {onAction ? (
        <button type="button" className="acMobileEmptyStateAction" onClick={onAction}>
          {actionLabel ?? copy.action}
        </button>
      ) : null}
    </div>
  )
}

function EmptyIcon({ variant }: { variant: MobileEmptyStateVariant }) {
  if (variant === 'noEmployees') {
    return (
      <svg viewBox="0 0 48 48" className="acMobileEmptyStateSvg">
        <circle cx="18" cy="16" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M6 38c0-6 5-10 12-10s12 4 12 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M32 14h10M37 9v10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  if (variant === 'noTasks') {
    return (
      <svg viewBox="0 0 48 48" className="acMobileEmptyStateSvg">
        <rect x="8" y="10" width="32" height="28" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M16 20h16M16 26h10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  if (variant === 'workdayNotStarted') {
    return (
      <svg viewBox="0 0 48 48" className="acMobileEmptyStateSvg">
        <circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M24 14v10l6 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 48 48" className="acMobileEmptyStateSvg">
      <path d="M12 8h24v32H12z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M18 16h12M18 22h12M18 28h8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
