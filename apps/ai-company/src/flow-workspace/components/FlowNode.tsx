import type { Employee } from '../types';
import { STATUS_META } from '../lib/status';
import { ShapeGlyph } from '../lib/shapes';
import { NODE_POS } from '../lib/layout';
import { FONT_MONO } from '../lib/tokens';
import { StatusDot } from './StatusDot';
import { useI18n } from '../../i18n';

const AI_ICON_BG = 'radial-gradient(circle at 30% 25%,rgba(139,124,255,.25),rgba(139,124,255,.05))';

interface Props {
  employee: Employee;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function FlowNode({ employee, selected, onSelect }: Props) {
  const { t } = useI18n();
  const pos = NODE_POS[employee.id];
  const meta = STATUS_META[employee.status];
  const isPlanned = employee.lifecycle === 'planned';
  const hasIn = employee.reportsTo !== null;
  const hasOut = employee.id === 'cto' || employee.id === 'ceo';

  return (
    <div
      className="itc-node"
      onClick={() => onSelect(employee.id)}
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        width: pos.w,
        zIndex: 3,
        cursor: 'pointer',
        opacity: isPlanned ? 0.52 : 1,
        background: 'linear-gradient(180deg,#16171d,#101115)',
        border: `1px solid ${selected ? 'rgba(139,124,255,.55)' : isPlanned ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.08)'}`,
        borderRadius: 12,
        padding: '11px 13px',
        transition: 'transform .14s, border-color .14s, opacity .14s',
        animation: selected && !isPlanned ? 'itcGlow 2.4s ease-in-out infinite' : undefined,
      }}
    >
      {hasIn && (
        <span
          style={{
            position: 'absolute',
            left: -6,
            top: 'calc(50% - 5px)',
            width: 11,
            height: 11,
            borderRadius: '50%',
            background: '#0a0a0c',
            border: '2px solid #5b6068',
          }}
        />
      )}
      {hasOut && (
        <span
          style={{
            position: 'absolute',
            right: -6,
            top: 'calc(50% - 5px)',
            width: 11,
            height: 11,
            borderRadius: '50%',
            background: '#0a0a0c',
            border: `2px solid ${isPlanned ? '#5b6068' : '#8b7cff'}`,
            boxShadow: isPlanned ? undefined : '0 0 8px rgba(139,124,255,.6)',
          }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            flex: 'none',
            background: AI_ICON_BG,
            border: '1px solid rgba(139,124,255,.28)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ShapeGlyph shape={employee.shape} size={12} color="#aeb4ff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: '#f0f1f3',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {employee.name}
            </span>
            {!isPlanned && <StatusDot status={employee.status} />}
          </div>
          <div
            style={{
              fontSize: 9.5,
              letterSpacing: '.07em',
              textTransform: 'uppercase',
              color: '#7c828c',
              fontWeight: 600,
              marginTop: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {employee.role}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 9, display: 'flex', alignItems: 'center', gap: 7 }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            padding: '2px 7px',
            borderRadius: 5,
            color: isPlanned ? '#6e7681' : meta.color,
            background: isPlanned ? 'rgba(255,255,255,.04)' : `${meta.color}1f`,
            border: `1px solid ${isPlanned ? 'rgba(255,255,255,.08)' : `${meta.color}40`}`,
          }}
        >
          {isPlanned ? t.labels.planned.toLowerCase() : meta.label}
        </span>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            color: '#6b7280',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {employee.model}
        </span>
      </div>
    </div>
  );
}
