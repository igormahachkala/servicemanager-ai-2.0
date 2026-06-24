import { CANVAS_W, CANVAS_H } from '../lib/layout';

export interface Edge {
  d: string;
  color: string;
  active: boolean;
}

/** SVG layer: base connectors + animated dashed overlay for active edges. */
export function ConnectorLayer({ edges }: { edges: Edge[] }) {
  return (
    <svg width={CANVAS_W} height={CANVAS_H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }} fill="none">
      {edges.map((e, i) => (
        <path key={`base-${i}`} d={e.d} stroke={e.color} strokeWidth={1.6} opacity={0.9} />
      ))}
      {edges.filter((e) => e.active).map((e, i) => (
        <path
          key={`active-${i}`}
          d={e.d}
          stroke="#8b7cff"
          strokeWidth={1.8}
          strokeDasharray="4 6"
          strokeLinecap="round"
          style={{ animation: 'itcDash .7s linear infinite' }}
        />
      ))}
    </svg>
  );
}
