/**
 * Employee Connections Center — legacy env migration helper (AI-COMPANY-115).
 */

import { resolveCursorAutomationWebhookConfig } from '../cursorAutomationRunner/cursorAutomationWebhookConfig'
import { getEffectiveOllamaBaseUrl, loadOllamaSettings } from '../runtime/providers/runtimeHealth'
import { maskSecretValue } from './employeeConnectionsSecretRedaction'
import type { LegacyRuntimeConnectionHint } from './employeeConnectionsTypes'

const ENV = import.meta.env ?? ({} as ImportMetaEnv)

function readEnv(key: string): string | undefined {
  const value = ENV[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function detectLegacyRuntimeConnections(): LegacyRuntimeConnectionHint[] {
  const hints: LegacyRuntimeConnectionHint[] = []

  const cursorConfig = resolveCursorAutomationWebhookConfig()
  if (cursorConfig.url || cursorConfig.apiKey) {
    hints.push({
      providerId: 'cursor-automations',
      displayName: 'Cursor Automations (legacy env)',
      detected: Boolean(cursorConfig.url && cursorConfig.apiKey),
      message: cursorConfig.url && cursorConfig.apiKey
        ? 'Legacy webhook env detected — create a Connections Center entry to replace manual .env editing.'
        : 'Partial Cursor webhook env detected — complete migration in Connections Center.',
      suggestedAuthMethod: 'WEBHOOK_SECRET',
      configurationPreview: {
        webhookUrl: cursorConfig.url ?? null,
        secretMask: cursorConfig.apiKey ? maskSecretValue(cursorConfig.apiKey) : null,
        repositoryOwner: readEnv('VITE_GITHUB_EVIDENCE_REPOSITORY_ALLOWLIST')?.split('/')[0] ?? null,
        repositoryName: readEnv('VITE_GITHUB_EVIDENCE_REPOSITORY_ALLOWLIST')?.split('/')[1] ?? null,
        baseBranch: 'main',
        branchPrefix: readEnv('VITE_GITHUB_EVIDENCE_BRANCH_PREFIX') ?? 'cursor/',
      },
    })
  }

  const githubAllowlist = readEnv('VITE_GITHUB_EVIDENCE_REPOSITORY_ALLOWLIST')
  if (githubAllowlist) {
    hints.push({
      providerId: 'github',
      displayName: 'GitHub Evidence (legacy env)',
      detected: true,
      message: 'Legacy GitHub evidence allowlist detected — migrate to GitHub Local Repository connection.',
      suggestedAuthMethod: 'LOCAL_SESSION',
      configurationPreview: {
        repository: githubAllowlist,
        mode: readEnv('VITE_GITHUB_EVIDENCE_READER_MODE') ?? 'gh_cli',
      },
    })
  }

  const ollamaSettings = loadOllamaSettings()
  const ollamaEndpoint = getEffectiveOllamaBaseUrl(ollamaSettings)
  hints.push({
    providerId: 'ollama',
    displayName: 'Ollama (legacy settings)',
    detected: Boolean(ollamaEndpoint),
    message: 'Legacy Ollama endpoint detected in runtime settings — migrate to Connections Center.',
    suggestedAuthMethod: 'LOCAL_RUNTIME',
    configurationPreview: {
      endpoint: ollamaEndpoint,
      defaultModel: ollamaSettings.defaultModelTag,
      mode: ollamaSettings.endpointMode,
    },
  })

  return hints
}
