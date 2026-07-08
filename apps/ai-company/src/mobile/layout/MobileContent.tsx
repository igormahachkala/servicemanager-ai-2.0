import type { ReactNode } from 'react'

type MobileContentProps = {
  children: ReactNode
  padded?: boolean
  /** When FAB is hidden (e.g. Run Task form), use smaller bottom inset. */
  fabVisible?: boolean
}

export function MobileContent({ children, padded = true, fabVisible = true }: MobileContentProps) {
  const classes = [
    'acMobileContent',
    padded ? 'acMobileContentPadded' : '',
    fabVisible ? '' : 'acMobileContentNoFab',
  ]
    .filter(Boolean)
    .join(' ')

  return <main className={classes}>{children}</main>
}
