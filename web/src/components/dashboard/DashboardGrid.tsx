import type { ReactNode } from 'react'

export function DashboardGrid(props: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      }}
    >
      {props.children}
    </div>
  )
}
