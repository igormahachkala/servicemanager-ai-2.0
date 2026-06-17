/**
 * Prompt builder: assemble the system instruction, the PROJECT CONTEXT block
 * (selected file contents) and the task into the final Ollama request, plus a
 * human-readable manifest that is prepended to the task result for traceability.
 */

import type { AgentTask } from './smaClient'
import type { LoadedContext } from './contextLoader'
import type { SelectionResult } from './fileSelector'
import type { TaskMode } from './taskModeDetector'
import { DRY_RUN_OUTPUT_SECTIONS, dryRunManifestExtra } from './implementDryRun'

const COMMON_RULES = [
  'You are the Engineering Agent executor for ServiceManager.AI, running in READ-ONLY mode.',
  'You are given a TASK and a PROJECT CONTEXT containing real source files from the codebase.',
  'Strict rules:',
  '- Base your work ONLY on the provided files and the task. Do NOT invent files, APIs, dates or facts.',
  '- If the context is insufficient, say so and list what additional files you would need.',
  '- You CANNOT execute code, run shell commands, modify files, push, deploy, or change anything.',
  '- Never echo secrets, tokens, passwords or API keys, even if present in the context.',
]

const AUDIT_SYSTEM = [
  ...COMMON_RULES,
  'Produce a CODE AUDIT. For each finding use exactly this structure:',
  'Problem: <what is wrong, referencing concrete files/symbols>',
  'Risk: <impact + severity>',
  'Recommendation: <how to fix>',
  'Effort: <Low | Medium | High>',
].join('\n')

const PLAN_SYSTEM = [
  ...COMMON_RULES,
  '- For code changes, describe the plan and a proposed diff in prose; do NOT claim it was applied.',
  'Produce a CHANGE PLAN. Use exactly this structure:',
  'Task: <restate the goal>',
  'Files: <files to create/modify, by path>',
  'Changes: <concrete changes per file, with proposed diffs/snippets in prose>',
  'Constraints: <what must not break — isolation, guards, API compatibility>',
  'Checks: <how to verify — build, tests, manual steps>',
  'Expected Result: <observable outcome when done>',
].join('\n')

const IMPLEMENT_DRY_RUN_SYSTEM = [
  ...COMMON_RULES,
  '- This is a DRY RUN. You MUST NOT claim any file was changed, branch created, pushed, or PR opened.',
  '- Describe only the PROPOSED change. Provide the patch as a proposed unified-diff-style preview in prose.',
  '- Use the EXACT Branch and PR Title given in the task input verbatim; do NOT invent different ones.',
  '- Limit "Files" and "Patch Preview" to files you can justify from the PROJECT CONTEXT.',
  'Produce an IMPLEMENT DRY-RUN PREVIEW. Output exactly these sections, each as "Section: <content>":',
  ...DRY_RUN_OUTPUT_SECTIONS.map((s) => `${s}: <...>`),
].join('\n')

export function systemFor(mode: TaskMode): string {
  if (mode === 'AUDIT') return AUDIT_SYSTEM
  if (mode === 'IMPLEMENT_DRY_RUN') return IMPLEMENT_DRY_RUN_SYSTEM
  return PLAN_SYSTEM
}

export interface BuiltPrompt {
  system: string
  prompt: string
  manifest: string
}

export interface PromptMeta {
  codeCommit?: string | null
  mode: TaskMode
  /** Deterministic, authoritative facts for IMPLEMENT_DRY_RUN (never model-invented). */
  branchName?: string
  prTitle?: string
}

export function buildPrompt(
  task: AgentTask,
  selection: SelectionResult,
  context: LoadedContext,
  meta: PromptMeta,
): BuiltPrompt {
  const contextBlock = context.files
    .map(
      (f) =>
        `===== file: ${f.path}${f.truncated ? ' (truncated)' : ''} =====\n${f.content}`,
    )
    .join('\n\n')

  const dryRunFacts =
    meta.mode === 'IMPLEMENT_DRY_RUN' && meta.branchName
      ? ['', 'DRY-RUN FACTS (use verbatim):', `Branch: ${meta.branchName}`, `PR Title: ${meta.prTitle ?? ''}`]
      : []

  const prompt = [
    'TASK:',
    `Title: ${task.title}`,
    task.prompt,
    ...dryRunFacts,
    '',
    `PROJECT CONTEXT (${context.files.length} files, ${context.totalBytes} bytes):`,
    contextBlock || '(no files selected — analyze from the task text and state what context is missing)',
  ].join('\n')

  const manifest = buildManifest(selection, context, meta)
  return { system: systemFor(meta.mode), prompt, manifest }
}

/** Manifest prepended to the result so a human can see exactly what the model saw. */
export function buildManifest(
  selection: SelectionResult,
  context: LoadedContext,
  meta: PromptMeta,
): string {
  const lines: string[] = []
  lines.push('<!-- agent-runner context manifest -->')
  lines.push(`Task Type: ${meta.mode}`)
  if (meta.mode === 'IMPLEMENT_DRY_RUN') {
    if (meta.branchName) lines.push(`Proposed branch: ${meta.branchName}`)
    lines.push(...dryRunManifestExtra())
  }
  if (meta.codeCommit) lines.push(`Code commit: ${meta.codeCommit}`)
  lines.push(`Selection mode: ${selection.mode}${selection.matchedGroups.length ? ` (${selection.matchedGroups.join(', ')})` : ''}`)
  lines.push(`Files in context (${context.files.length}, ${context.totalBytes} bytes):`)
  for (const f of context.files) lines.push(`  - ${f.path}${f.truncated ? ' (truncated)' : ''} [${f.bytes}B]`)
  if (context.skipped.length) {
    lines.push(`Skipped (${context.skipped.length}):`)
    for (const s of context.skipped) lines.push(`  - ${s.path} — ${s.reason}`)
  }
  lines.push('---')
  return lines.join('\n')
}
