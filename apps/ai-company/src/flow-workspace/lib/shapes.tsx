import type { CSSProperties } from 'react';
import type { NodeShape } from '../types';

const CLIP: Partial<Record<NodeShape, string>> = {
  triangle: 'polygon(50% 0,100% 100%,0 100%)',
  hex:      'polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)',
  pentagon: 'polygon(50% 0,100% 38%,82% 100%,18% 100%,0 38%)',
  plus:     'polygon(38% 0,62% 0,62% 38%,100% 38%,100% 62%,62% 62%,62% 100%,38% 100%,38% 62%,0 62%,0 38%,38% 38%)',
};

/**
 * Role glyph. Pure CSS shape (clip-path / border) — no icon dependency.
 * owner → ring · cto → diamond · architect → triangle · developer → square
 * qa → hex · devops → pentagon · pm → circle · designer → pill · support → plus
 */
export function ShapeGlyph({
  shape,
  size = 12,
  color = '#aeb4ff',
}: {
  shape: NodeShape;
  size?: number;
  color?: string;
}) {
  const base: CSSProperties = { width: size, height: size, background: color, flex: 'none' };
  switch (shape) {
    case 'ring':
      return <span style={{ ...base, background: 'transparent', borderRadius: '50%', border: `2px solid ${color}` }} />;
    case 'square':
      return <span style={{ ...base, borderRadius: 2 }} />;
    case 'diamond':
      return <span style={{ ...base, borderRadius: 2, transform: 'rotate(45deg)' }} />;
    case 'circle':
      return <span style={{ ...base, borderRadius: '50%' }} />;
    case 'pill':
      return <span style={{ ...base, width: Math.round(size * 1.3), height: Math.round(size * 0.6), borderRadius: 99 }} />;
    default:
      return <span style={{ ...base, clipPath: CLIP[shape] }} />;
  }
}
