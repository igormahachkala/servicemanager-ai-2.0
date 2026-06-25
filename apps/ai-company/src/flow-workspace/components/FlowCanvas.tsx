import { useMemo } from 'react';
import type { Connection, Employee } from '../types';
import { isActive } from '../lib/status';
import { inPort, outPort, bezier, CANVAS_W, CANVAS_H } from '../lib/layout';
import { FONT_MONO } from '../lib/tokens';
import { ConnectorLayer, type Edge } from './ConnectorLayer';
import { FlowNode } from './FlowNode';
import { useI18n } from '../../i18n';

interface Props {
  employees: Employee[];
  connections: Connection[];
  selectedId: string;
  onSelect: (id: string) => void;
}

interface BadgedEdge extends Edge {
  badge: number;
  bx: number;
  by: number;
}

/** Center canvas: dotted background, connector SVG, edge badges, node cards. */
export function FlowCanvas({ employees, connections, selectedId, onSelect }: Props) {
  const { t } = useI18n();
  const byId = useMemo(
    () => Object.fromEntries(employees.map((e) => [e.id, e])) as Record<string, Employee>,
    [employees],
  );

  const edges = useMemo<BadgedEdge[]>(
    () =>
      connections.map((c) => {
        const a = outPort(c.from);
        const b = inPort(c.to);
        const target = byId[c.to];
        const source = byId[c.from];
        const edgeActive =
          !!target &&
          target.lifecycle === 'active' &&
          isActive(target.status) &&
          source?.lifecycle === 'active';
        return {
          d: bezier(a, b),
          color: edgeActive ? 'rgba(139,124,255,.45)' : 'rgba(91,96,104,.35)',
          active: edgeActive,
          badge: c.badge,
          bx: (a.x + b.x) / 2,
          by: (a.y + b.y) / 2 - 2,
        };
      }),
    [connections, byId],
  );

  return (
    <main
      style={{
        gridColumn: 2, gridRow: 2, position: 'relative', overflow: 'auto', minWidth: 0, minHeight: 0,
        backgroundColor: '#0a0a0c',
        backgroundImage:
          'radial-gradient(700px 380px at 60% 30%,rgba(139,124,255,.07),transparent 60%),radial-gradient(circle at 1px 1px,rgba(255,255,255,.04) 1px,transparent 0)',
        backgroundSize: 'auto, 22px 22px',
      }}
    >
      {/* breadcrumb */}
      <div style={{ position: 'absolute', top: 14, left: 18, zIndex: 5, display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: '#6b7280', fontFamily: FONT_MONO, background: 'rgba(12,13,16,.7)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 7, padding: '5px 10px' }}>
        {t.flow.breadcrumb}
      </div>

      <div style={{ position: 'relative', width: CANVAS_W, height: CANVAS_H, margin: '8px auto 24px' }}>
        <ConnectorLayer edges={edges} />

        {/* edge item-count badges */}
        {edges.map((e, i) => (
          <div
            key={`badge-${i}`}
            style={{
              position: 'absolute', left: e.bx, top: e.by, transform: 'translate(-50%,-50%)', zIndex: 2,
              fontFamily: FONT_MONO, fontSize: 9.5, color: '#a99dff', background: '#15131f',
              border: '1px solid rgba(139,124,255,.3)', borderRadius: 6, padding: '1px 6px', lineHeight: 1.5,
            }}
          >
            {e.badge}
          </div>
        ))}

        {/* nodes */}
        {employees.map((e) => (
          <FlowNode key={e.id} employee={e} selected={e.id === selectedId} onSelect={onSelect} />
        ))}
      </div>
    </main>
  );
}
