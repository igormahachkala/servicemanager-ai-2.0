import type { ReactNode } from 'react'

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent'

const variantClass: Record<BadgeVariant, string> = {
  default: 'acBadgeDefault',
  success: 'acBadgeSuccess',
  warning: 'acBadgeWarning',
  danger: 'acBadgeDanger',
  info: 'acBadgeInfo',
  accent: 'acBadgeAccent',
}

export function Badge(props: { variant?: BadgeVariant; children: ReactNode }) {
  const variant = props.variant ?? 'default'
  return <span className={`acBadge ${variantClass[variant]}`}>{props.children}</span>
}
