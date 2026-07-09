import type { MobileChatIntentKind, MobileChatIntentResult } from './mobileChatIntentTypes'
import { isMobileChatIntentKind } from './mobileChatIntentTypes'

const CASUAL_PATTERNS = [
  /^(?:привет|здравств|hi|hello|hey|добр(?:ое|ый)|спасибо|thanks|thank you|ок|ok|okay|понятно|ясно|👍)[!.?\s]*$/i,
]

const QUESTION_START =
  /^(?:что|как|где|когда|почему|зачем|сколько|какой|какая|какие|можно ли|есть ли|who|what|how|why|when|where|is there|are there)\b/i

const TASK_VERBS =
  /(?:провер(?:ь|ить|ка)|сделай|сделать|найди|найти|подготов(?:ь|ить)|запуст(?:и|ить)|сформир(?:уй|овать)|проанализируй|проанализировать|исправ(?:ь|ить)|собери|собрать|состав(?:ь|ить)|напиши|написать|review|audit|check|fix|prepare|analyze|implement|build|run|create|deploy|investigate|найди баг|find bug)/i

const COMPLEX_MARKERS =
  /(?:аудит|architecture|архитектур|план разработки|stage readiness|готовность к stage|complex|structured|deliverables|ограничения|constraints|не делай|forbidden|срочно|critical|несколько шагов|backlog|sprint)/i

const CURSOR_MARKERS = /(?:cursor|handoff|codex|ide|репозитор|pull request|pr\b)/i

const REPORT_MARKERS =
  /(?:утренн(?:ий|яя) отчёт|утренний отчет|morning report|runtime report|сформир(?:уй|овать) отчёт|сформировать отчет|prepare report|итог дня|journal|отчёт по|отчет по)/i

function normalizeMessage(message: string): string {
  return message.trim().replace(/\s+/g, ' ')
}

function result(
  kind: MobileChatIntentKind,
  confidence: number,
  rationale: string,
): MobileChatIntentResult {
  return {
    kind,
    confidence,
    source: 'heuristic',
    rationale,
  }
}

export function detectMobileChatIntentHeuristic(message: string): MobileChatIntentResult {
  const text = normalizeMessage(message)
  if (!text) {
    return result('unclear', 0.9, 'empty message')
  }

  if (text.length <= 24 && CASUAL_PATTERNS.some((pattern) => pattern.test(text))) {
    return result('casual_question', 0.92, 'greeting or acknowledgment')
  }

  if (CURSOR_MARKERS.test(text)) {
    return result('complex_task_request', 0.86, 'cursor handoff markers')
  }

  if (REPORT_MARKERS.test(text)) {
    return result('report_request', 0.88, 'report request markers')
  }

  const hasTaskVerb = TASK_VERBS.test(text)
  const isQuestion = text.endsWith('?') || QUESTION_START.test(text)

  if (hasTaskVerb && (text.length >= 120 || COMPLEX_MARKERS.test(text))) {
    return result('complex_task_request', 0.84, 'task verb with complex markers or long text')
  }

  if (hasTaskVerb) {
    return result('task_request', 0.82, 'imperative task verb')
  }

  if (isQuestion && text.length <= 160) {
    return result('simple_question', 0.78, 'short question without task verb')
  }

  if (text.length >= 80 && !isQuestion) {
    return result('task_request', 0.62, 'long free-form message treated as task draft')
  }

  if (text.length < 12) {
    return result('unclear', 0.7, 'too short to classify')
  }

  if (isQuestion) {
    return result('simple_question', 0.65, 'question fallback')
  }

  return result('unclear', 0.55, 'no strong signal')
}

export function parseOllamaIntentKind(raw: string): MobileChatIntentKind | null {
  const normalized = raw.trim().toLowerCase()
  if (isMobileChatIntentKind(normalized)) return normalized
  const jsonMatch = normalized.match(/"intent"\s*:\s*"([a-z_]+)"/)
  if (jsonMatch && isMobileChatIntentKind(jsonMatch[1])) return jsonMatch[1]
  return null
}
