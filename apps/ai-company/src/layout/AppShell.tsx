import type { ReactNode } from 'react'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="acApp">
      <div className="acMain">{children}</div>
    </div>
  )
}
