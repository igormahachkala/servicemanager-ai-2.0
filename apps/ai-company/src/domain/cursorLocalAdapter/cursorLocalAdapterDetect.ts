/**
 * Detect locally confirmed Cursor capabilities (AI-COMPANY-113C).
 * Browser-safe: no shell exec, no token reads.
 */

import type { CursorLocalCapability, CursorLocalCapabilityId } from './cursorLocalAdapterTypes'

type DetectContext = {
  platform: string
  isBrowser: boolean
}

function detectContext(): DetectContext {
  const platform =
    typeof navigator !== 'undefined' ? navigator.platform || 'unknown' : 'unknown'
  return { platform, isBrowser: typeof window !== 'undefined' }
}

function capability(
  id: CursorLocalCapabilityId,
  partial: Omit<CursorLocalCapability, 'id'>,
): CursorLocalCapability {
  return { id, ...partial }
}

/**
 * Research-backed defaults for macOS dev (Cursor 3.9.16 confirmed on research machine).
 * Browser runtime cannot verify binary paths at runtime — flags reflect confirmed research + runtime limits.
 */
export function detectCursorLocalCapabilities(context: DetectContext = detectContext()): CursorLocalCapability[] {
  const isDarwin = /mac/i.test(context.platform)
  const isBrowser = context.isBrowser

  return [
    capability('filesystem_inbox', {
      available: true,
      confirmed: true,
      requiresManualAction: true,
      requiresUserSession: false,
      requiresApiAuth: false,
      notes: isBrowser
        ? 'Envelope in localStorage + relative paths for export; disk write requires Owner export.'
        : 'Repo-relative .ai-company/cursor-inbox/ supported with filesystem access.',
    }),
    capability('clipboard_handoff', {
      available: true,
      confirmed: true,
      requiresManualAction: true,
      requiresUserSession: true,
      requiresApiAuth: false,
      notes: '110C handoff — Owner paste in Cursor.',
    }),
    capability('cli_open_workspace', {
      available: isDarwin && !isBrowser,
      confirmed: isDarwin,
      requiresManualAction: true,
      requiresUserSession: true,
      requiresApiAuth: false,
      notes: isBrowser
        ? 'Blocked in browser SPA — cannot spawn /Applications/Cursor.app/.../cursor.'
        : 'Bundled cursor binary can open workspace (confirmed research).',
    }),
    capability('cli_open_file', {
      available: isDarwin && !isBrowser,
      confirmed: isDarwin,
      requiresManualAction: true,
      requiresUserSession: true,
      requiresApiAuth: false,
      notes: 'cursor -g file:line confirmed; browser cannot invoke.',
    }),
    capability('cli_chat_window', {
      available: isDarwin && !isBrowser,
      confirmed: isDarwin,
      requiresManualAction: true,
      requiresUserSession: true,
      requiresApiAuth: false,
      notes: 'cursor --chat opens standalone chat; requires active session.',
    }),
    capability('cursor_agent_cli', {
      available: false,
      confirmed: true,
      requiresManualAction: true,
      requiresUserSession: true,
      requiresApiAuth: true,
      notes: 'cursor-agent exists but uses cloud auth — blocked (no Cursor API policy).',
    }),
    capability('cursor_automation_ui', {
      available: true,
      confirmed: true,
      requiresManualAction: true,
      requiresUserSession: true,
      requiresApiAuth: false,
      notes: 'UI-only Automations — no CLI automation subcommand confirmed.',
    }),
  ]
}

export function resolveCursorLocalAdapterStatus(
  capabilities: CursorLocalCapability[] = detectCursorLocalCapabilities(),
): 'unsupported' | 'partial' | 'ready' | 'blocked' {
  const inbox = capabilities.find((item) => item.id === 'filesystem_inbox')
  if (!inbox?.available) return 'unsupported'
  if (capabilities.some((item) => item.id === 'cursor_agent_cli' && item.requiresApiAuth)) {
    return 'partial'
  }
  return 'partial'
}

/** Bundled macOS path from research — not invoked from browser. */
export const CURSOR_MACOS_BUNDLED_CLI_PATH =
  '/Applications/Cursor.app/Contents/Resources/app/bin/cursor'

export const CURSOR_LOCAL_INBOX_RELATIVE = '.ai-company/cursor-inbox'

export const CURSOR_LOCAL_OUTBOX_RELATIVE = '.ai-company/cursor-outbox'
