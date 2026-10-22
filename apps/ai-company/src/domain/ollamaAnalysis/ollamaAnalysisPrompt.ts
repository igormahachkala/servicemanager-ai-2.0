/**
 * Analysis prompt — ported from agent-runner/src/promptBuilder.ts
 * (COMMON_RULES + AUDIT_SYSTEM).
 *
 * The PROJECT CONTEXT block is deliberately absent. agent-runner builds it from
 * the filesystem (contextLoader/fileSelector); the browser domain has no such
 * access, and porting that layer needs a bridge (STATE.md §6). The prompt states
 * the absence instead of letting the model assume it was given the repository.
 *
 * The sections are REQUESTED here and nothing more — parsing and validating them
 * is block 3, so no consumer may assume they are present in the answer.
 */

const COMMON_RULES = [
  'You are the analysis executor for AI Company, running in READ-ONLY mode.',
  'Strict rules:',
  '- Base your work ONLY on the task text. Do NOT invent files, APIs, dates or facts.',
  '- If the information is insufficient, say so and list what you would need.',
  '- You CANNOT execute code, run shell commands, modify files, push or deploy.',
  '- Never echo secrets, tokens, passwords or API keys.',
]

/** Section names the prompt asks for. Block 3 validates the answer against this list. */
export const OLLAMA_ANALYSIS_SECTIONS = ['Problem', 'Risk', 'Recommendation', 'Effort'] as const

export const OLLAMA_ANALYSIS_SYSTEM = [
  ...COMMON_RULES,
  'Produce a CODE AUDIT. For each finding use exactly this structure:',
  'Problem: <what is wrong, referencing concrete files/symbols>',
  'Risk: <impact + severity>',
  'Recommendation: <how to fix>',
  'Effort: <Low | Medium | High>',
  'Keep the four labels (Problem, Risk, Recommendation, Effort) in English exactly as written,',
  'but write their content in the language of the task.',
].join('\n')

export type AnalysisContextFile = {
  path: string
  content: string | null
  truncated?: boolean
  /** Why content is null (unreadable, missing). */
  error?: string | null
}

export function buildOllamaAnalysisPrompt(input: {
  title: string
  instructions: string
  files?: AnalysisContextFile[]
}): string {
  const head = ['TASK:', `Title: ${input.title}`, input.instructions, '']
  const files = input.files ?? []
  if (files.length === 0) {
    return [
      ...head,
      'PROJECT CONTEXT: none was provided with this request.',
      'Analyze from the task text alone and state which files you would need to be certain.',
    ].join('\n')
  }
  const blocks = files.map((f) => {
    if (f.content === null) return `--- FILE: ${f.path} (not available: ${f.error ?? 'unreadable'}) ---`
    const note = f.truncated ? ' (truncated)' : ''
    return `--- FILE: ${f.path}${note} ---\n${f.content}\n--- END FILE: ${f.path} ---`
  })
  return [
    ...head,
    `PROJECT CONTEXT: ${files.length} file(s) from the repository, provided by the owner.`,
    'Reference these files and symbols concretely. Do not invent files that are not shown;',
    'if something outside them is needed, name it.',
    '',
    ...blocks,
  ].join('\n')
}

/**
 * Context window for a prompt: Ollama's default (2-4k tokens) silently cuts
 * long prompts, so a prompt with files asks for enough room. Rough estimate:
 * 3 characters per token, plus room for the answer.
 */
export function contextWindowFor(prompt: string, system = ''): number | null {
  const promptTokens = Math.ceil((prompt.length + system.length) / 3)
  if (promptTokens <= 2048) return null // fits Ollama's default window
  const tokens = promptTokens + 4096
  const rounded = Math.ceil(tokens / 8192) * 8192
  return Math.min(Math.max(rounded, 8192), 65536)
}
