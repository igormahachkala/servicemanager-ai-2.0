import type { CSSProperties } from 'react'

type SmaBrandLogoProps = {
  compact?: boolean
  variant?: 'footer' | 'sidebar' | 'header'
  style?: CSSProperties
}

export function SmaBrandLogo({ compact = false, variant, style }: SmaBrandLogoProps) {
  const classes = [
    'smaBrandLogo',
    compact ? 'smaBrandLogoCompact' : '',
    variant ? `smaBrandLogo-${variant}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} aria-label="СМА" style={style}>
      <img src="/src/assets/sma-logo-ru.svg" alt="СМА — Технологии для сервиса" />
    </div>
  )
}
