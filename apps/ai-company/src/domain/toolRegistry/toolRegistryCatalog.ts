import type { ToolRegistryEntryV1 } from './toolRegistry'

const DEFAULT_HISTORY = {
  persisted: true,
  storageSurface: 'toolExecution' as const,
  retentionDays: 90,
}

const DEFAULT_LOGGING = {
  auditEvents: true,
  runtimeLogs: true,
  executionLogPage: '/ops/tool-executions' as const,
  approvalEvents: true,
}

/** V1 catalog — ten tools. Execution adapters not connected. */
export const TOOL_REGISTRY_V1_CATALOG: ToolRegistryEntryV1[] = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: 'Read and write files within an approved workspace root.',
    purpose: 'Inspect repo, read configs, write reports and patches inside scoped paths.',
    riskLevel: 'medium',
    requiresOwnerApproval: false,
    transport: 'local',
    registryToolId: 'tool-filesystem',
    input: {
      description: 'Path-relative file operation request.',
      schemaHint: '{ action: read|write|list|delete, path: string, content?: string, encoding?: utf8 }',
      example: { action: 'read', path: 'apps/ai-company/src/domain/toolRegistry/index.ts' },
    },
    output: {
      description: 'File content, listing, or write confirmation.',
      schemaHint: '{ ok: boolean, path: string, content?: string, entries?: string[], bytesWritten?: number }',
    },
    history: DEFAULT_HISTORY,
    errorHandling: 'Path outside workspace → denied. Missing file → not_found. Permission denied → failed.',
    logging: DEFAULT_LOGGING,
    employeeNeedHint: 'Task requires reading or editing project files on disk.',
  },
  {
    id: 'terminal',
    name: 'Terminal',
    description: 'Run shell commands in a sandboxed session (V2 — not enabled in V1).',
    purpose: 'Build, test, npm scripts — only after Owner approval and sandbox policy.',
    riskLevel: 'critical',
    requiresOwnerApproval: true,
    transport: 'cli',
    registryToolId: 'tool-terminal',
    input: {
      description: 'Single command or scripted sequence with cwd.',
      schemaHint: '{ command: string, cwd?: string, env?: Record<string,string>, timeoutMs?: number }',
      example: { command: 'npm run build', cwd: 'apps/ai-company', timeoutMs: 120000 },
    },
    output: {
      description: 'Exit code, stdout/stderr streams, duration.',
      schemaHint: '{ exitCode: number, stdout: string, stderr: string, elapsedMs: number }',
    },
    history: { ...DEFAULT_HISTORY, storageSurface: 'toolRegistryInvoke' },
    errorHandling: 'Non-zero exit → failed with stderr. Timeout → aborted. Blocked command → policy_denied.',
    logging: DEFAULT_LOGGING,
    employeeNeedHint: 'Task cannot be completed without running shell commands (build, test, install).',
  },
  {
    id: 'git',
    name: 'Git',
    description: 'Local Git operations in the repository (status, diff, commit — push gated).',
    purpose: 'Inspect VCS state and prepare commits; never bypass Owner approval on push.',
    riskLevel: 'high',
    requiresOwnerApproval: true,
    transport: 'cli',
    registryToolId: 'tool-git',
    input: {
      description: 'Git subcommand with args.',
      schemaHint: '{ action: status|diff|log|commit|branch|checkout, args?: string[], message?: string }',
      example: { action: 'status' },
    },
    output: {
      description: 'Porcelain/plain git output and metadata.',
      schemaHint: '{ ok: boolean, stdout: string, branch?: string, changedFiles?: string[] }',
    },
    history: DEFAULT_HISTORY,
    errorHandling: 'Dirty tree / conflict → failed with message. Push without approval → blocked.',
    logging: DEFAULT_LOGGING,
    employeeNeedHint: 'Task requires inspecting or changing version control state.',
  },
  {
    id: 'docker',
    name: 'Docker',
    description: 'Container lifecycle and compose operations on approved hosts.',
    purpose: 'Inspect images, run compose stacks for dev — production deploy always gated.',
    riskLevel: 'critical',
    requiresOwnerApproval: true,
    transport: 'cli',
    registryToolId: 'tool-docker',
    input: {
      description: 'Docker CLI intent (read-only vs mutating).',
      schemaHint: '{ action: ps|logs|inspect|compose-up|compose-down, target?: string, composeFile?: string }',
      example: { action: 'ps' },
    },
    output: {
      description: 'Container list, logs tail, or compose result.',
      schemaHint: '{ ok: boolean, containers?: unknown[], logs?: string, message?: string }',
    },
    history: DEFAULT_HISTORY,
    errorHandling: 'Daemon unreachable → unavailable. Mutating action without approval → denied.',
    logging: DEFAULT_LOGGING,
    employeeNeedHint: 'Task involves containers, compose, or deployment artifacts.',
  },
  {
    id: 'playwright',
    name: 'Playwright',
    description: 'Browser automation for QA and acceptance flows.',
    purpose: 'Run scripted UI checks against local or staging URLs.',
    riskLevel: 'high',
    requiresOwnerApproval: true,
    transport: 'browser-automation',
    registryToolId: 'tool-playwright',
    input: {
      description: 'Test script reference or inline steps.',
      schemaHint: '{ suite: string, baseUrl: string, headless?: boolean, artifactsDir?: string }',
      example: { suite: 'acceptance-desktop-qa-001', baseUrl: 'http://localhost:5177', headless: true },
    },
    output: {
      description: 'Pass/fail, screenshots, trace paths.',
      schemaHint: '{ ok: boolean, passed: number, failed: number, reportPath?: string, screenshots?: string[] }',
    },
    history: { ...DEFAULT_HISTORY, storageSurface: 'toolRegistryInvoke' },
    errorHandling: 'Navigation timeout → failed. Assertion mismatch → failed with artifact links.',
    logging: DEFAULT_LOGGING,
    employeeNeedHint: 'Task requires verifying UI behavior in a real browser.',
  },
  {
    id: 'cursor-automation',
    name: 'Cursor Automation',
    description:
      'Cursor Automations as the primary external coding executor — scheduled or handoff-triggered agent workflows.',
    purpose:
      'Delegate bounded implementation subtasks after local Ollama reasoning; produces PRs for MAX review.',
    riskLevel: 'high',
    requiresOwnerApproval: true,
    transport: 'cursor-automation',
    registryToolId: 'tool-cursor-automation',
    input: {
      description: 'Automation plan from digital employee handoff.',
      schemaHint:
        '{ title: string, instructions: string, repository: { owner, repo, branch }, trigger: manual|runtime-handoff|git|schedule, enabledTools?: string[] }',
      example: {
        title: 'AI-COMPANY-097A scaffold',
        instructions: 'Add types and docs only — no shell, no deploy.',
        repository: { owner: 'igor', repo: 'servicemanager-ai-2.0', branch: 'ai-company-flow' },
        trigger: { kind: 'runtime-handoff', runtimeRunId: 'run-123', employeeId: 'ag-max' },
      },
    },
    output: {
      description: 'PR summary, transcript ref, rule candidates, Runtime Report patch.',
      schemaHint:
        '{ ok: boolean, prSummary?: { url, number, changedFiles, checksStatus }, transcriptRef?: string, ruleCandidates?: object[] }',
    },
    history: { ...DEFAULT_HISTORY, storageSurface: 'toolRegistryInvoke' },
    errorHandling:
      'API unavailable → failed. Missing Owner approval → approval_pending. Scope outside repo → denied.',
    logging: DEFAULT_LOGGING,
    employeeNeedHint:
      'Implementation subtask after local reasoning — prefer Cursor Automation over Claude/Codex CLI at current stage.',
  },
  {
    id: 'claude-code-cli',
    name: 'Claude Code CLI',
    description: 'Anthropic Claude Code CLI as an external coding agent tool.',
    purpose: 'Delegate bounded coding subtasks — not a digital employee persona.',
    riskLevel: 'high',
    requiresOwnerApproval: true,
    transport: 'cli',
    registryToolId: 'tool-claude-code-cli',
    input: {
      description: 'Prompt + repo scope for CLI session.',
      schemaHint: '{ prompt: string, workspaceRoot: string, maxTurns?: number, readOnly?: boolean }',
      example: { prompt: 'Explain toolRegistry module', workspaceRoot: 'apps/ai-company', readOnly: true },
    },
    output: {
      description: 'Agent transcript summary and changed files list.',
      schemaHint: '{ ok: boolean, summary: string, filesTouched?: string[], transcriptRef?: string }',
    },
    history: DEFAULT_HISTORY,
    errorHandling: 'CLI missing → unavailable. Scope violation → denied. User abort → cancelled.',
    logging: DEFAULT_LOGGING,
    employeeNeedHint: 'Subtask fits a coding agent CLI; employee orchestrates, CLI executes.',
  },
  {
    id: 'codex-cli',
    name: 'Codex CLI',
    description: 'OpenAI Codex CLI as an external coding agent tool.',
    purpose: 'Same as Claude Code CLI — tool invoked by employee, not an employee role.',
    riskLevel: 'high',
    requiresOwnerApproval: true,
    transport: 'cli',
    registryToolId: 'tool-codex-cli',
    input: {
      description: 'Codex task with directory sandbox.',
      schemaHint: '{ task: string, directory: string, sandbox?: full|read-only, model?: string }',
      example: { task: 'Add types for tool registry', directory: 'apps/ai-company', sandbox: 'read-only' },
    },
    output: {
      description: 'Completion summary and diff stats.',
      schemaHint: '{ ok: boolean, summary: string, diffStats?: { files: number, insertions: number, deletions: number } }',
    },
    history: DEFAULT_HISTORY,
    errorHandling: 'Auth failure → failed. Sandbox breach attempt → policy_denied.',
    logging: DEFAULT_LOGGING,
    employeeNeedHint: 'Owner-approved coding subtask for Codex CLI within scoped directory.',
  },
  {
    id: 'browser',
    name: 'Browser',
    description: 'Interactive browser session for research and manual verification.',
    purpose: 'Navigate pages, capture snapshots — distinct from Playwright batch QA.',
    riskLevel: 'medium',
    requiresOwnerApproval: true,
    transport: 'native',
    registryToolId: 'tool-browser',
    input: {
      description: 'Navigation or snapshot request.',
      schemaHint: '{ url: string, action: navigate|snapshot|screenshot, waitMs?: number }',
      example: { url: 'http://localhost:5177/ops/runtime', action: 'snapshot' },
    },
    output: {
      description: 'Accessibility snapshot or screenshot reference.',
      schemaHint: '{ ok: boolean, url: string, title?: string, snapshotRef?: string, screenshotRef?: string }',
    },
    history: DEFAULT_HISTORY,
    errorHandling: 'Blocked URL / SSRF policy → denied. Load failure → failed.',
    logging: DEFAULT_LOGGING,
    employeeNeedHint: 'Task needs live page inspection beyond static codebase search.',
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'GitHub API / MCP — issues, PRs, checks, repo metadata.',
    purpose: 'Remote repository operations; all write/deploy capabilities require approval.',
    riskLevel: 'high',
    requiresOwnerApproval: true,
    transport: 'mcp',
    registryToolId: 'tool-github',
    input: {
      description: 'GitHub resource action.',
      schemaHint: '{ action: read|create-pr|comment|merge|list-checks, owner: string, repo: string, payload?: object }',
      example: { action: 'list-checks', owner: 'org', repo: 'servicemanager-ai-2.0' },
    },
    output: {
      description: 'API-normalized JSON result.',
      schemaHint: '{ ok: boolean, data?: unknown, rateLimitRemaining?: number }',
    },
    history: DEFAULT_HISTORY,
    errorHandling: '401/403 → auth_failed. Rate limit → retry_after. Merge without approval → blocked.',
    logging: DEFAULT_LOGGING,
    employeeNeedHint: 'Task requires GitHub issues, PRs, or CI status outside local git.',
  },
]

export function getToolRegistryV1Catalog(): ToolRegistryEntryV1[] {
  return TOOL_REGISTRY_V1_CATALOG
}

export function getToolRegistryV1EntryById(id: string): ToolRegistryEntryV1 | null {
  return TOOL_REGISTRY_V1_CATALOG.find((entry) => entry.id === id) ?? null
}

export function getToolRegistryV1EntryByRegistryToolId(registryToolId: string): ToolRegistryEntryV1 | null {
  return TOOL_REGISTRY_V1_CATALOG.find((entry) => entry.registryToolId === registryToolId) ?? null
}
