import type { Messages } from '../i18n/en';

function resolveMockRelativeTime(t: Messages, label: string): string {
  if (label === 'now') return t.mock.relativeTime.now;
  const match = /^(\d+)m ago$/.exec(label);
  if (match) {
    return t.mock.relativeTime.minutesAgo.replace('{minutes}', match[1]);
  }
  return label;
}

/** Resolve mock/seed display strings through i18n. */
export function resolveMockActivityLabel(t: Messages, label: string): string {
  if (label === 'Awaiting V1 activation') return t.mock.lastActivity;
  return resolveMockRelativeTime(t, label);
}

export function resolveMockSquad(t: Messages, key: keyof Messages['mock']['squads']): string {
  return t.mock.squads[key];
}
