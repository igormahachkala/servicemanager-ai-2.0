import type { ReactNode } from 'react'
import { TopNav } from './TopNav'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="acApp">
      <TopNav />
      <div className="acMain">{children}</div>
    </div>
  )
}
