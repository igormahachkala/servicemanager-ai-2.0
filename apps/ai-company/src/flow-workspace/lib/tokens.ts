// Shared literals for the Mission Control screen.
// Kept inline-friendly for the prototype; later move into the it-company design tokens.

export const FONT_UI = 'Geist, system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_MONO = '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

// Surface palette
export const C = {
  canvas: '#0a0a0c',
  panel: '#0c0d10',
  hairline: 'rgba(255,255,255,.06)',
  nodeGrad: 'linear-gradient(180deg,#16171d,#101115)',
  purple: '#8b7cff',
  purpleSoft: '#a99dff',
  textHi: '#f0f1f3',
  text: '#e6e8eb',
  textBody: '#dfe2e7',
  textMute: '#7c828c',
  textFaint: '#6b7280',
  textGhost: '#5b6068',
} as const;
