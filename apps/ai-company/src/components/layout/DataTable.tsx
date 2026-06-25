import type { ReactNode } from 'react'

export function DataTable(props: { children: ReactNode }) {
  return (
    <div className="acTableWrap">
      <table className="acTable">{props.children}</table>
    </div>
  )
}
