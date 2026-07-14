/**
 * Cursor Automation — webhook HTTP client (AI-COMPANY-113).
 */

import { redactCursorAutomationSecret } from './cursorAutomationSecretRedaction'
import type {
  CursorAutomationWebhookConfig,
  CursorAutomationWebhookResponse,
} from './cursorAutomationRunnerTypes'

export type CursorAutomationFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>

function parseWebhookBody(rawBody: string | null): {
  success: boolean
  backgroundComposerId: string | null
  errorMessage: string | null
} {
  if (!rawBody) {
    return { success: false, backgroundComposerId: null, errorMessage: 'Empty response body.' }
  }

  try {
    const parsed: unknown = JSON.parse(rawBody)
    if (typeof parsed !== 'object' || parsed === null) {
      return {
        success: false,
        backgroundComposerId: null,
        errorMessage: 'Response body is not a JSON object.',
      }
    }
    const record = parsed as Record<string, unknown>
    const success = record.success === true
    const backgroundComposerId =
      typeof record.backgroundComposerId === 'string' && record.backgroundComposerId.trim()
        ? record.backgroundComposerId.trim()
        : null
    const errorMessage =
      typeof record.error === 'string'
        ? record.error
        : typeof record.message === 'string'
          ? record.message
          : null
    return { success, backgroundComposerId, errorMessage }
  } catch {
    return {
      success: false,
      backgroundComposerId: null,
      errorMessage: 'Response body is not valid JSON.',
    }
  }
}

export async function invokeCursorAutomationWebhook(input: {
  config: CursorAutomationWebhookConfig
  body: Record<string, unknown>
  fetchImpl?: CursorAutomationFetch
}): Promise<CursorAutomationWebhookResponse> {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch?.bind(globalThis)
  if (!fetchImpl) {
    return {
      httpStatus: 0,
      success: false,
      backgroundComposerId: null,
      errorMessage: 'fetch is unavailable in this runtime.',
      rawBody: null,
      retryable: true,
    }
  }

  if (!input.config.url?.trim() || !input.config.apiKey?.trim()) {
    return {
      httpStatus: 0,
      success: false,
      backgroundComposerId: null,
      errorMessage: 'Webhook URL or API key is missing.',
      rawBody: null,
      retryable: false,
    }
  }

  try {
    const response = await fetchImpl(input.config.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input.body),
    })

    const rawBody = await response.text()
    const parsed = parseWebhookBody(rawBody)
    const httpStatus = response.status

    if (httpStatus === 401) {
      return {
        httpStatus,
        success: false,
        backgroundComposerId: null,
        errorMessage: redactCursorAutomationSecret(
          parsed.errorMessage ?? 'Unauthorized webhook call.',
          input.config.apiKey,
        ),
        rawBody: redactCursorAutomationSecret(rawBody, input.config.apiKey),
        retryable: false,
      }
    }

    if (httpStatus === 400) {
      return {
        httpStatus,
        success: false,
        backgroundComposerId: null,
        errorMessage: redactCursorAutomationSecret(
          parsed.errorMessage ?? 'Webhook rejected the request.',
          input.config.apiKey,
        ),
        rawBody: redactCursorAutomationSecret(rawBody, input.config.apiKey),
        retryable: false,
      }
    }

    if (httpStatus >= 500) {
      return {
        httpStatus,
        success: false,
        backgroundComposerId: null,
        errorMessage: redactCursorAutomationSecret(
          parsed.errorMessage ?? 'Webhook server error.',
          input.config.apiKey,
        ),
        rawBody: redactCursorAutomationSecret(rawBody, input.config.apiKey),
        retryable: true,
      }
    }

    if (httpStatus !== 200) {
      return {
        httpStatus,
        success: false,
        backgroundComposerId: null,
        errorMessage: `Unexpected HTTP status ${httpStatus}.`,
        rawBody: redactCursorAutomationSecret(rawBody, input.config.apiKey),
        retryable: httpStatus >= 500,
      }
    }

    if (!parsed.success || !parsed.backgroundComposerId) {
      return {
        httpStatus,
        success: false,
        backgroundComposerId: parsed.backgroundComposerId,
        errorMessage:
          parsed.errorMessage ??
          (parsed.success
            ? 'HTTP 200 without backgroundComposerId.'
            : 'HTTP 200 with success=false.'),
        rawBody: redactCursorAutomationSecret(rawBody, input.config.apiKey),
        retryable: false,
      }
    }

    return {
      httpStatus,
      success: true,
      backgroundComposerId: parsed.backgroundComposerId,
      errorMessage: null,
      rawBody: redactCursorAutomationSecret(rawBody, input.config.apiKey),
      retryable: false,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error.'
    return {
      httpStatus: 0,
      success: false,
      backgroundComposerId: null,
      errorMessage: redactCursorAutomationSecret(message, input.config.apiKey),
      rawBody: null,
      retryable: true,
    }
  }
}
