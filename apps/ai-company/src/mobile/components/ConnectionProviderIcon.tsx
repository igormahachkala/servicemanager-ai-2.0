/**
 * Connection provider icon — neutral integration icons (AI-COMPANY-115).
 */

const ICON_LABELS: Record<string, string> = {
  github: 'GH',
  cursor: 'CR',
  ollama: 'OL',
  gmail: 'GM',
  'google-calendar': 'GC',
  'google-drive': 'GD',
  figma: 'FG',
  n8n: 'N8',
  servicemanager: 'SM',
  max: 'MX',
}

type ConnectionProviderIconProps = {
  iconKey: string
  className?: string
}

export function ConnectionProviderIcon({ iconKey, className }: ConnectionProviderIconProps) {
  const label = ICON_LABELS[iconKey] ?? 'IN'
  return (
    <span className={className ?? 'acConnectionProviderIcon'} aria-hidden="true">
      {label}
    </span>
  )
}
