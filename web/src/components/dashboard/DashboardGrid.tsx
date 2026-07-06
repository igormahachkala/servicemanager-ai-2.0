import type { ReactNode } from 'react'

export function DashboardGrid(props: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 18,
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        alignItems: 'stretch',
      }}
    >
      {props.children}
    </div>
  )
}
