import type { ReactNode } from 'react'

type MobileSectionProps = {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}

export function MobileSection({ title, description, action, children }: MobileSectionProps) {
  return (
    <section className="acMobileSection">
      <header className="acMobileSectionHeader">
        <div className="acMobileSectionHeaderText">
          <h2 className="acMobileSectionTitle">{title}</h2>
          {description ? <p className="acMobileSectionDescription">{description}</p> : null}
        </div>
        {action ? <div className="acMobileSectionAction">{action}</div> : null}
      </header>
      <div className="acMobileSectionBody">{children}</div>
    </section>
  )
}
