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

export function buildOllamaAnalysisPrompt(input: {
  title: string
  instructions: string
}): string {
  return [
    'TASK:',
    `Title: ${input.title}`,
    input.instructions,
    '',
    'PROJECT CONTEXT: none was provided with this request.',
    'Analyze from the task text alone and state which files you would need to be certain.',
  ].join('\n')
}
