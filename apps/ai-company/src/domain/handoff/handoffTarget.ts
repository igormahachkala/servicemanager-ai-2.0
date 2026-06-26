export const HANDOFF_TARGETS = [
  'codex',
  'claude_code',
  'cursor',
  'human_developer',
  'devops',
  'designer',
  'qa',
] as const

export type HandoffTarget = (typeof HANDOFF_TARGETS)[number]

export const HANDOFF_TARGET_LABELS: Record<HandoffTarget, string> = {
  codex: 'Codex',
  claude_code: 'Claude Code',
  cursor: 'Cursor',
  human_developer: 'Human Developer',
  devops: 'DevOps',
  designer: 'Designer',
  qa: 'QA',
}

export function isHandoffTarget(value: string): value is HandoffTarget {
  return (HANDOFF_TARGETS as readonly string[]).includes(value)
}
