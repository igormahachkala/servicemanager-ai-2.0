import type { ReactNode } from 'react'

type MobileCardStatus = {
  label: string
  tone?: 'default' | 'success' | 'warning' | 'error' | 'info'
}

type MobileCardProps = {
  title: string
  description?: string
  status?: MobileCardStatus
  secondaryText?: string
  actions?: ReactNode
  onClick?: () => void
  children?: ReactNode
}

const STATUS_CLASS: Record<NonNullable<MobileCardStatus['tone']>, string> = {
  default: 'acMobileCardStatusDefault',
  success: 'acMobileCardStatusSuccess',
  warning: 'acMobileCardStatusWarning',
  error: 'acMobileCardStatusError',
  info: 'acMobileCardStatusInfo',
}

export function MobileCard({
  title,
  description,
  status,
  secondaryText,
  actions,
  onClick,
  children,
}: MobileCardProps) {
  const interactive = Boolean(onClick)
  const Root = interactive ? 'button' : 'article'

  return (
    <Root
      type={interactive ? 'button' : undefined}
      className={interactive ? 'acMobileCard acMobileCardInteractive' : 'acMobileCard'}
      onClick={onClick}
    >
      <div className="acMobileCardHead">
        <div className="acMobileCardHeadText">
          <h3 className="acMobileCardTitle">{title}</h3>
          {description ? <p className="acMobileCardDescription">{description}</p> : null}
        </div>
        {status ? (
          <span className={`acMobileCardStatus ${STATUS_CLASS[status.tone ?? 'default']}`}>
            {status.label}
          </span>
        ) : null}
      </div>
      {children ? <div className="acMobileCardBody">{children}</div> : null}
      {secondaryText ? <p className="acMobileCardSecondary">{secondaryText}</p> : null}
      {actions ? <div className="acMobileCardActions">{actions}</div> : null}
    </Root>
  )
}
