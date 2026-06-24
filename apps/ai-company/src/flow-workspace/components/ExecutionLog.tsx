import type { LogEntry } from '../types';
import { LOG_COLOR } from '../lib/status';
import { FONT_UI, FONT_MONO } from '../lib/tokens';

interface Props {
  entries: LogEntry[];
  summary: { success: number; running: number; failed: number };
}

/** Bottom execution log (col 2 / row 3). */
export function ExecutionLog({ entries, summary }: Props) {
  return (
    <footer
      style={{
        gridColumn: 2, gridRow: 3, borderTop: '1px solid rgba(255,255,255,.06)', background: '#0c0d10',
        display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 40, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#e6e8eb' }}>Execution Log</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: '#6b7280', background: 'rgba(255,255,255,.05)', borderRadius: 5, padding: '1px 7px' }}>live</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 10.5, fontFamily: FONT_MONO, color: '#6b7280' }}>
          <span style={{ color: '#3fb950' }}>● {summary.success} success</span>
          <span style={{ color: '#d29922' }}>● {summary.running} running</span>
          <span style={{ color: '#f85149' }}>● {summary.failed} failed</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '4px 6px', fontFamily: FONT_MONO }}>
        {entries.map((l, i) => {
          const color = LOG_COLOR[l.status];
          return (
            <div key={i} className="itc-rowh" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '5px 10px', borderRadius: 6 }}>
              <span style={{ fontSize: 11, color: '#5b6068', width: 50, flex: 'none' }}>{l.t}</span>
              <span style={{ width: 7, height: 7, borderRadius: l.status === 'Failed' ? 2 : '50%', background: color, boxShadow: `0 0 7px ${color}`, flex: 'none', animation: l.status === 'Running' ? 'itcPulse 1.4s ease-in-out infinite' : undefined }} />
              <span style={{ fontSize: 12, color: '#e6e8eb', width: 104, flex: 'none', fontFamily: FONT_UI, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.node}</span>
              <span style={{ fontSize: 11.5, color: '#9aa0aa', flex: 1, minWidth: 0, fontFamily: FONT_UI, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.msg}</span>
              <span style={{ fontSize: 11, color, width: 64, flex: 'none', textAlign: 'right', fontFamily: FONT_UI, fontWeight: 600 }}>{l.status}</span>
              <span style={{ fontSize: 11, color: '#6b7280', width: 54, flex: 'none', textAlign: 'right' }}>{l.dur}</span>
            </div>
          );
        })}
      </div>
    </footer>
  );
}
