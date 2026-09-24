export type DiffLine = {
  type: 'context' | 'add' | 'remove' | 'hunk'
  text: string
  lineNo?: number
}

export type MockPatch = {
  filename: string
  additions: number
  deletions: number
  lines: DiffLine[]
}

const LINE_STYLE: Record<DiffLine['type'], React.CSSProperties> = {
  add: { background: '#dcfce7', color: '#166534' },
  remove: { background: '#fee2e2', color: '#991b1b' },
  context: { background: 'transparent', color: '#374151' },
  hunk: { background: '#eff6ff', color: '#1d4ed8' },
}

const LINE_PREFIX: Record<DiffLine['type'], string> = {
  add: '+',
  remove: '-',
  context: ' ',
  hunk: '@',
}

type Props = {
  patches: MockPatch[]
  collapsed: boolean
  onToggle: () => void
}

export function PatchPreviewPanel({ patches, collapsed, onToggle }: Props) {
  const totalAdd = patches.reduce((acc, p) => acc + p.additions, 0)
  const totalDel = patches.reduce((acc, p) => acc + p.deletions, 0)

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: '#f9fafb',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: 13,
          gap: 8,
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#6b7280', fontFamily: 'monospace' }}>③</span>
          <span>Patch Preview</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>+{totalAdd}</span>
          <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>-{totalDel}</span>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{patches.length} {patches.length === 1 ? 'файл' : 'файла'}</span>
          <span style={{ color: '#9ca3af', fontSize: 11 }}>{collapsed ? '▸' : '▾'}</span>
        </span>
      </button>

      {!collapsed && (
        <div style={{ padding: '12px 14px', display: 'grid', gap: 10 }}>
          {patches.map((patch) => (
            <div key={patch.filename} style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <div
                style={{
                  padding: '6px 12px',
                  background: '#f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#374151', fontWeight: 600 }}>
                  {patch.filename}
                </span>
                <span style={{ display: 'flex', gap: 6, fontSize: 12 }}>
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>+{patch.additions}</span>
                  <span style={{ color: '#dc2626', fontWeight: 600 }}>-{patch.deletions}</span>
                </span>
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: 0,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 12,
                  lineHeight: 1.5,
                  overflowX: 'auto',
                }}
              >
                {patch.lines.map((line, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '0 12px',
                      display: 'flex',
                      gap: 8,
                      ...LINE_STYLE[line.type],
                    }}
                  >
                    <span style={{ userSelect: 'none', color: line.type === 'hunk' ? '#1d4ed8' : '#9ca3af', minWidth: 12 }}>
                      {LINE_PREFIX[line.type]}
                    </span>
                    <span>{line.text}</span>
                  </div>
                ))}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
