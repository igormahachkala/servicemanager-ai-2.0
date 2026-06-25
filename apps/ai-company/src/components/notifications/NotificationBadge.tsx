
export function NotificationBadge(props: { count: number; compact?: boolean }) {
  if (props.count <= 0) return null

  return (
    <span
      className={`acNotificationBadge${props.compact ? ' acNotificationBadgeCompact' : ''}`}
      aria-label={`${props.count} unread`}
    >
      {props.count > 99 ? '99+' : props.count}
    </span>
  )
}
