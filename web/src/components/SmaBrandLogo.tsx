import type { CSSProperties } from 'react'
import smaLogoRu from '../assets/sma-logo-ru.svg'

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
    <div className={classes} aria-label="СМА-Тех" style={style}>
      <img src={smaLogoRu} alt="СМА-Тех — разработчик платформы Сервис Менеджер" />
    </div>
  )
}
