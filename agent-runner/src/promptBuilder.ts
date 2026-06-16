/**
 * Prompt builder: assemble the system instruction, the PROJECT CONTEXT block
 * (selected file contents) and the task into the final Ollama request, plus a
 * human-readable manifest that is prepended to the task result for traceability.
 */

import type { AgentTask } from './smaClient'
import type { LoadedContext } from './contextLoader'
import type { SelectionResult } from './fileSelector'

const SYSTEM_PROMPT = [
  'You are the Engineering Agent executor for ServiceManager.AI, running in READ-ONLY V1 mode.',
  'You are given a TASK and a PROJECT CONTEXT containing real source files from the codebase.',
  'Strict rules:',
  '- Base your analysis ONLY on the provided files and the task. Do NOT invent files, APIs, dates or facts.',
  '- If the context is insufficient, say so and list what additional files you would need.',
  '- You CANNOT execute code, run shell commands, modify files, push, deploy, or change anything.',
  '- Never echo secrets, tokens, passwords or API keys, even if present in the context.',
  '- For code changes, describe the plan and a proposed diff in prose; do not claim it was applied.',
  'Produce a concise, structured analysis: findings, recommended approach, risks, next steps.',
].join('\n')

export interface BuiltPrompt {
  system: string
  prompt: string
  manifest: string
}

export function buildPrompt(
  task: AgentTask,
  selection: SelectionResult,
  context: LoadedContext,
  meta: { codeCommit?: string | null },
): BuiltPrompt {
  const contextBlock = context.files
    .map(
      (f) =>
        `===== file: ${f.path}${f.truncated ? ' (truncated)' : ''} =====\n${f.content}`,
    )
    .join('\n\n')

  const prompt = [
    'TASK:',
    `Title: ${task.title}`,
    task.prompt,
    '',
    `PROJECT CONTEXT (${context.files.length} files, ${context.totalBytes} bytes):`,
    contextBlock || '(no files selected — analyze from the task text and state what context is missing)',
  ].join('\n')

  const manifest = buildManifest(selection, context, meta)
  return { system: SYSTEM_PROMPT, prompt, manifest }
}

/** Manifest prepended to the result so a human can see exactly what the model saw. */
export function buildManifest(
  selection: SelectionResult,
  context: LoadedContext,
  meta: { codeCommit?: string | null },
): string {
  const lines: string[] = []
  lines.push('<!-- agent-runner V1 context manifest -->')
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
