/**
 * IMPLEMENT_DRY_RUN — a SAFE preview of a future IMPLEMENT change.
 *
 * Produces a proposed branch name, PR title and a structured change preview
 * (files, proposed diff, checks, risks, rollback) WITHOUT writing any file,
 * creating any branch, pushing, or opening a PR.
 *
 * This module is pure: string helpers + constants only. It performs NO I/O and
 * NO git/filesystem calls — the "no-write" guarantee is structural, not enforced
 * at runtime, because nothing here (or downstream of it) can mutate anything.
 *
 * It deliberately imports nothing from the rest of the runner so it can be a
 * leaf dependency of both taskModeDetector and promptBuilder without cycles.
 */

/** The explicit, opt-in marker. IMPLEMENT_DRY_RUN is NEVER inferred from
 *  natural-language keywords — only this literal token activates it. */
export const IMPLEMENT_DRY_RUN_MARKER = 'IMPLEMENT_DRY_RUN'

/** True only when the task text contains the explicit IMPLEMENT_DRY_RUN marker. */
export function hasImplementDryRunMarker(task: { title: string; prompt: string }): boolean {
  const text = `${task.title}\n${task.prompt}`
  return new RegExp(`\\b${IMPLEMENT_DRY_RUN_MARKER}\\b`, 'i').test(text)
}

/** Ordered sections the model must emit, in this exact order (per SMA-AI-002). */
export const DRY_RUN_OUTPUT_SECTIONS = [
  'Task',
  'Branch',
  'PR Title',
  'Files',
  'Proposed Changes',
  'Patch Preview',
  'Checks',
  'Risks',
  'Rollback',
  'Expected Result',
] as const

/** Slug for a branch name: lowercase, alphanumerics → hyphens, trimmed, capped.
 *  Non-Latin titles (e.g. Cyrillic) collapse to empty → fallback to 'change'. */
export function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
  return s || 'change'
}

/** Proposed branch name: agent/<task-id>-<slug>. Computed deterministically —
 *  never invented by the model. */
export function proposedBranchName(taskId: string, title: string): string {
  return `agent/${taskId}-${slugify(title)}`
}

/** Proposed PR title, derived from the task title. */
export function proposedPrTitle(task: { title: string }): string {
  const t = task.title.trim()
  return t ? `[AI Developer] ${t}` : '[AI Developer] Proposed change'
}

/** Extra manifest lines that make the no-op guarantees explicit in the result. */
export function dryRunManifestExtra(): string[] {
  return ['No files written: true', 'No git push: true', 'No PR created: true']
}

/** Human-readable confirmation printed during a dry-run preview. */
export function dryRunNoWriteConfirmation(): string {
  return 'no-write confirmation: IMPLEMENT_DRY_RUN writes no files, creates no branch, no git push, no PR'
}
