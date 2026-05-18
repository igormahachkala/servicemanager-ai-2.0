type SmaBrandLogoProps = {
  compact?: boolean
}

export function SmaBrandLogo({ compact = false }: SmaBrandLogoProps) {
  return (
    <div className={compact ? 'smaBrandLogo smaBrandLogoCompact' : 'smaBrandLogo'} aria-label="СМА">
      <img src="/src/assets/sma-logo-ru.svg" alt="СМА — Технологии для сервиса" />
    </div>
  )
}
