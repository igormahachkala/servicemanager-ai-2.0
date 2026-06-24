import type { Employee } from '../types';
import { STATUS_META } from '../lib/status';
import { ShapeGlyph } from '../lib/shapes';

interface Props {
  employees: Employee[];
  selectedId: string;
  onSelect: (id: string) => void;
}

/** Slim 62px vertical rail of node tiles, one per employee, in org order. */
export function NodeRail({ employees, selectedId, onSelect }: Props) {
  return (
    <aside
      style={{
        gridColumn: 1, gridRow: '2 / 4', background: '#0c0d10',
        borderRight: '1px solid rgba(255,255,255,.06)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', padding: '14px 0', gap: 6, overflow: 'hidden', minWidth: 0,
      }}
    >
      {employees.map((e) => {
        const meta = STATUS_META[e.status];
        const selected = e.id === selectedId;
        return (
          <button
            key={e.id}
            className="itc-btn"
            title={`${e.name} · ${e.role}`}
            onClick={() => onSelect(e.id)}
            style={{
              width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', position: 'relative',
              border: `1px solid ${selected ? 'rgba(139,124,255,.6)' : 'rgba(255,255,255,.08)'}`,
              background: selected ? 'rgba(139,124,255,.12)' : 'rgba(255,255,255,.02)',
            }}
          >
            <ShapeGlyph shape={e.shape} size={13} color={e.kind === 'human' ? '#e6e8eb' : '#aeb4ff'} />
            <span style={{ position: 'absolute', top: 5, right: 5, width: 6, height: 6, borderRadius: '50%', background: meta.color, boxShadow: `0 0 6px ${meta.color}` }} />
          </button>
        );
      })}

      <div style={{ flex: 1 }} />
      <div
        title="Add node"
        style={{
          width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#5b6068', border: '1px dashed rgba(255,255,255,.12)', cursor: 'pointer',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6}><path d="M8 3v10M3 8h10" strokeLinecap="round" /></svg>
      </div>
    </aside>
  );
}
