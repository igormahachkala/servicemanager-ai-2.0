/**
 * Task mode detection: decide whether a task asks for an AUDIT (analyse and
 * report) or a PLAN (propose concrete engineering changes). Pure heuristic over
 * the task text — no model, no I/O. Low confidence defaults to PLAN.
 */

export type TaskMode = 'AUDIT' | 'PLAN'

// Cyrillic stems are matched as substrings (prefix-style); Latin words are
// matched with word boundaries so "preview" does NOT trigger "review", nor
// "prefix" trigger "fix".
const AUDIT_STEMS = ['аудит', 'проанализ', 'анализ', 'проверить', 'проверь', 'проверка', 'найти проблем', 'найди проблем', 'ревью']
const AUDIT_WORDS = ['review', 'audit', 'assess']

const PLAN_STEMS = ['добав', 'реализ', 'исправ', 'создать', 'создай', 'внедр', 'измени', 'изменить', 'рефактор']
const PLAN_WORDS = ['refactor', 'implement', 'fix', 'build', 'add', 'introduce', 'migrate', 'create']

function matches(text: string, stems: string[], words: string[]): string[] {
  const hits = stems.filter((s) => text.includes(s))
  for (const w of words) {
    if (new RegExp(`\\b${w}\\b`, 'i').test(text)) hits.push(w)
  }
  return hits
}

export interface ModeDetection {
  mode: TaskMode
  confidence: 'high' | 'low'
  reason: string
  auditHits: string[]
  planHits: string[]
}

export function detectMode(task: { title: string; prompt: string }): ModeDetection {
  const text = `${task.title}\n${task.prompt}`.toLowerCase()
  const auditHits = matches(text, AUDIT_STEMS, AUDIT_WORDS)
  const planHits = matches(text, PLAN_STEMS, PLAN_WORDS)

  if (planHits.length > 0 && auditHits.length === 0) {
    return mk('PLAN', 'high', `plan keywords: ${planHits.join(', ')}`, auditHits, planHits)
  }
  if (auditHits.length > 0 && planHits.length === 0) {
    return mk('AUDIT', 'high', `audit keywords: ${auditHits.join(', ')}`, auditHits, planHits)
  }
  if (auditHits.length > 0 && planHits.length > 0) {
    // both present — prefer the stronger signal; tie -> PLAN (low confidence).
    if (auditHits.length > planHits.length) {
      return mk('AUDIT', 'low', `mixed signals (audit ${auditHits.length} > plan ${planHits.length})`, auditHits, planHits)
    }
    return mk('PLAN', 'low', `mixed signals (plan ${planHits.length} >= audit ${auditHits.length})`, auditHits, planHits)
  }
  // neither — default to PLAN at low confidence.
  return mk('PLAN', 'low', 'no mode keywords — defaulting to PLAN', auditHits, planHits)
}

function mk(mode: TaskMode, confidence: 'high' | 'low', reason: string, auditHits: string[], planHits: string[]): ModeDetection {
  return { mode, confidence, reason, auditHits, planHits }
}
