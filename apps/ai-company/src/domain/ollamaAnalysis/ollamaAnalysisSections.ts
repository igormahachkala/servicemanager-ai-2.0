/**
 * Section contract for a local analysis answer.
 *
 * Presence and non-emptiness only. Order is not enforced, and a free-form tail
 * after the last section is allowed on purpose: the prompt itself asks the model
 * to name the files it would need, and the live run answered with a trailing
 * "Files needed for certainty:" block. Rejecting that would reject a correct
 * answer.
 *
 * Any label line closes the previous block, so an unknown trailing label ends
 * `Effort` instead of padding it — "Effort:" followed only by such a tail is
 * still empty, and correctly fails. Several findings in one answer repeat the
 * sections; a section passes if ANY of its occurrences carries content.
 */

export const REQUIRED_ANALYSIS_SECTIONS = ['Problem', 'Risk', 'Recommendation', 'Effort'] as const

export type AnalysisSectionName = (typeof REQUIRED_ANALYSIS_SECTIONS)[number]

export type AnalysisSectionValidation = {
  ok: boolean
  present: AnalysisSectionName[]
  /** Header never appeared. */
  missing: AnalysisSectionName[]
  /** Header appeared, every occurrence blank. */
  empty: AnalysisSectionName[]
}

/** `Label: rest-of-line`. Bounded length so a prose line with a colon is not a header. */
const LABEL_LINE = /^\s*([A-Za-z][A-Za-z0-9 _-]{0,40})\s*:(.*)$/

export type AnalysisBlock = { label: string; content: string }
type Block = AnalysisBlock

function splitIntoBlocks(text: string): Block[] {
  const blocks: Block[] = []
  let current: Block | null = null

  for (const line of text.split('\n')) {
    const match = LABEL_LINE.exec(line)
    if (match) {
      current = { label: match[1].trim().toLowerCase(), content: match[2] }
      blocks.push(current)
      continue
    }
    // Body lines before any header belong to nothing and are dropped.
    if (current) current.content += `\n${line}`
  }

  return blocks
}

export function validateAnalysisSections(text: string): AnalysisSectionValidation {
  const blocks = splitIntoBlocks(text)

  const present: AnalysisSectionName[] = []
  const missing: AnalysisSectionName[] = []
  const empty: AnalysisSectionName[] = []

  for (const section of REQUIRED_ANALYSIS_SECTIONS) {
    const occurrences = blocks.filter((block) => block.label === section.toLowerCase())

    if (occurrences.length === 0) {
      missing.push(section)
      continue
    }

    present.push(section)
    if (!occurrences.some((block) => block.content.trim())) empty.push(section)
  }

  return {
    ok: missing.length === 0 && empty.length === 0,
    present,
    missing,
    empty,
  }
}

/** One-line reason for an envelope error and a log entry. */
export function describeSectionFailure(validation: AnalysisSectionValidation): string {
  return [
    validation.missing.length ? `missing: ${validation.missing.join(', ')}` : '',
    validation.empty.length ? `empty: ${validation.empty.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('; ')
}

/**
 * Ordered blocks for display: every `Label:` block in answer order, labels in
 * their original case, content trimmed. Text before the first label is
 * returned as a leading `preamble` so the UI never hides part of the answer.
 */
export function parseAnalysisBlocks(text: string): { preamble: string; blocks: AnalysisBlock[] } {
  const lines = text.split('\n')
  const firstLabel = lines.findIndex((line) => LABEL_LINE.test(line))
  const preamble = (firstLabel === -1 ? text : lines.slice(0, firstLabel).join('\n')).trim()
  if (firstLabel === -1) return { preamble, blocks: [] }
  const blocks: AnalysisBlock[] = []
  let current: AnalysisBlock | null = null
  for (const line of lines.slice(firstLabel)) {
    const match = LABEL_LINE.exec(line)
    if (match) {
      current = { label: match[1].trim(), content: match[2] }
      blocks.push(current)
    } else if (current) {
      current.content += `\n${line}`
    }
  }
  return { preamble, blocks: blocks.map((b) => ({ label: b.label, content: b.content.trim() })) }
}
