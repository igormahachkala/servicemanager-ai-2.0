import { getEffectiveOllamaBaseUrl, loadOllamaSettings } from '../runtime/providers/runtimeHealth'
import { resolveOllamaModelTag } from '../runtime/providers/runtimeCapabilities'
import {
  detectMobileChatIntentHeuristic,
  parseOllamaIntentKind,
} from './mobileChatIntentHeuristic'
import type { MobileChatIntentResult } from './mobileChatIntentTypes'
import { MOBILE_CHAT_INTENT_KINDS } from './mobileChatIntentTypes'

const OLLAMA_CLASSIFY_TIMEOUT_MS = 8000

type OllamaGenerateResponse = {
  response?: string
}

function buildClassificationPrompt(message: string): string {
  return [
    'Classify the Owner message to MAX into exactly one intent.',
    `Allowed intents: ${MOBILE_CHAT_INTENT_KINDS.join(', ')}.`,
    'Reply with JSON only: {"intent":"<one allowed intent>"}.',
    'Message:',
    message,
  ].join('\n')
}

export async function classifyMobileChatIntentWithOllama(
  message: string,
): Promise<MobileChatIntentResult | null> {
  if (typeof window === 'undefined') return null

  const settings = loadOllamaSettings()
  const baseUrl = getEffectiveOllamaBaseUrl(settings)
  const model = resolveOllamaModelTag(settings.defaultModelTag)
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), OLLAMA_CLASSIFY_TIMEOUT_MS)

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt: buildClassificationPrompt(message),
        stream: false,
        options: { temperature: 0.1, num_predict: 64 },
      }),
    })

    if (!response.ok) return null

    const payload = (await response.json()) as OllamaGenerateResponse
    const kind = parseOllamaIntentKind(payload.response ?? '')
    if (!kind) return null

    return {
      kind,
      confidence: 0.75,
      source: 'ollama',
      rationale: 'ollama classification',
    }
  } catch {
    return null
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function detectMobileChatIntent(message: string): Promise<MobileChatIntentResult> {
  const heuristic = detectMobileChatIntentHeuristic(message)

  if (heuristic.confidence >= 0.85 && heuristic.kind !== 'unclear') {
    return heuristic
  }

  const ollama = await classifyMobileChatIntentWithOllama(message)
  if (ollama) return ollama

  return {
    ...heuristic,
    source: ollama ? 'ollama_fallback' : heuristic.source,
  }
}
