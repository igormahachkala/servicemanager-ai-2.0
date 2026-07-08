import type { ReactNode } from 'react'

type MobileContentProps = {
  children: ReactNode
  padded?: boolean
}

export function MobileContent({ children, padded = true }: MobileContentProps) {
  return (
    <main className={padded ? 'acMobileContent acMobileContentPadded' : 'acMobileContent'}>
      {children}
    </main>
  )
}
