import type { CSSProperties } from 'react';
import { FONT_MONO } from '../lib/tokens';
import { useI18n } from '../../i18n';

interface Props {
  leftOpen: boolean;
  rightOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  nodeCount?: number;
  runningCount?: number;
}

/** Top bar: brand, live status, panel toggles, History + Execute. */
export function WorkspaceHeader({
  leftOpen, rightOpen, onToggleLeft, onToggleRight, nodeCount = 8, runningCount = 12,
}: Props) {
  const { t } = useI18n();

  return (
    <header
      style={{
        gridColumn: '1 / 4', display: 'flex', alignItems: 'center', gap: 14,
        padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,.06)', background: '#0c0d10', minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 14, borderRight: '1px solid rgba(255,255,255,.07)' }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#8b7cff,#5a4fcf)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px -2px rgba(139,124,255,.7)' }}>
          <div style={{ width: 10, height: 10, background: '#fff', transform: 'rotate(45deg)', borderRadius: 2 }} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f1f3', display: 'flex', alignItems: 'center', gap: 6 }}>
            {t.flow.brand}
            <span style={{ fontSize: 9, letterSpacing: '.12em', color: '#8b7cff', border: '1px solid rgba(139,124,255,.35)', borderRadius: 5, padding: '1px 6px', fontWeight: 600 }}>{t.flow.workflow}</span>
          </div>
          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>{t.flow.subtitle}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 11.5, color: '#7c828c' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3fb950', boxShadow: '0 0 8px #3fb950', animation: 'itcBlink 1.6s ease-in-out infinite' }} />
          {t.flow.executionActive}
        </span>
        <span style={{ color: '#3a3f48' }}>·</span>
        <span style={{ fontFamily: FONT_MONO }}>{nodeCount} {t.flow.nodes}</span>
        <span style={{ color: '#3a3f48' }}>·</span>
        <span style={{ fontFamily: FONT_MONO }}>{runningCount} {t.flow.activeCount}</span>
      </div>

      <div style={{ flex: 1 }} />

      <PanelToggle side="left" active={leftOpen} onClick={onToggleLeft} title={t.flow.toggleNodeRail} />
      <PanelToggle side="right" active={rightOpen} onClick={onToggleRight} title={t.flow.toggleInspector} />
      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,.1)' }} />

      <button className="itc-btn" onClick={() => { /* TODO: open run history */ }} style={ghostBtn}>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M8 2v6l4 2" strokeLinecap="round" /><circle cx="8" cy="8" r="6.2" /></svg>
        {t.flow.history}
      </button>

      <button onClick={() => { /* TODO: trigger orchestrator (out of scope for this task) */ }} style={primaryBtn}>
        <svg width="11" height="12" viewBox="0 0 12 14" fill="#fff"><path d="M1 1l10 6L1 13z" /></svg>
        {t.flow.executeWorkflow}
      </button>
    </header>
  );
}

function PanelToggle({ side, active, onClick, title }: { side: 'left' | 'right'; active: boolean; onClick: () => void; title: string }) {
  return (
    <button
      className="itc-btn"
      title={title}
      onClick={onClick}
      style={{
        width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', background: 'transparent',
        border: `1px solid ${active ? 'rgba(139,124,255,.4)' : 'rgba(255,255,255,.09)'}`,
        color: active ? '#a99dff' : '#6b7280',
      }}
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3}>
        <rect x="2" y="3" width="12" height="10" rx="2.2" />
        {side === 'left'
          ? <rect x="2" y="3" width="4.6" height="10" rx="1.4" fill="currentColor" stroke="none" />
          : <rect x="9.4" y="3" width="4.6" height="10" rx="1.4" fill="currentColor" stroke="none" />}
      </svg>
    </button>
  );
}

const ghostBtn: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 7, padding: '7px 11px',
  border: '1px solid rgba(255,255,255,.09)', borderRadius: 8, color: '#9aa0aa',
  fontSize: 12, background: 'transparent', cursor: 'pointer',
};

const primaryBtn: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 8,
  background: 'linear-gradient(180deg,#8b7cff,#6b5cf0)', color: '#fff', fontSize: 12.5, fontWeight: 600,
  border: 'none', cursor: 'pointer', boxShadow: '0 3px 14px -4px rgba(139,124,255,.8)',
};
