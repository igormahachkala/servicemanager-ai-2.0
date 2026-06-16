/**
 * agent-runner — V1 code-aware executor for the ServiceManager.AI Engineering Agent.
 *
 * Loop: login → poll GET /agent-tasks → pick first NEW → claim (IN_PROGRESS)
 *       → select files → load code context (safe) → build prompt
 *       → read-only Ollama analysis → PATCH result (manifest + redacted) → DONE/FAILED.
 *
 * Safety:
 *   - Default mode is dry-run. Live mutations require an explicit --live flag.
 *   - SMA base URL is allowlisted; production hosts are refused.
 *   - Reads configuration from process.env only (never a .env file).
 *   - Code context is read-only, within CODE_ROOT, allowlist dirs only, with
 *     denylist (.env/keys/secrets/binaries) + path-traversal protection + redact.
 *   - No shell, no filesystem writes, no repository mutations.
 */

import { loadConfig, secretValues, type Config } from './config'
import { SmaClient, type AgentTask } from './smaClient'
import { runAnalysis, type BuiltMessages } from './executor'
import { redact } from './redact'
import { type SelectionResult } from './fileSelector'
import { type LoadedContext } from './contextLoader'
import { buildPrompt } from './promptBuilder'
import { planContext, planToContext, type ContextPlan } from './contextPlanner'

function mask(value: string): string {
  if (!value) return '(unset)'
  if (value.length <= 4) return '****'
  return value.slice(0, 2) + '***' + value.slice(-2)
}

function log(msg: string): void {
  console.log(`[agent-runner] ${msg}`)
}

const EMPTY_SELECTION: SelectionResult = { selected: [], details: [], matchedGroups: [], mode: 'none', totalCandidates: 0 }
const EMPTY_CONTEXT: LoadedContext = { files: [], skipped: [], totalBytes: 0 }

function getArg(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined
}

function printPlan(config: Config, missing: string[], baseUrlReason: string): void {
  log('--- configuration ---')
  log(`mode:            ${config.mode}`)
  log(`once:            ${config.once}`)
  log(`apiBaseUrl:      ${config.apiBaseUrl || '(unset)'}  [${baseUrlReason}]`)
  log(`agentEmail:      ${config.agentEmail || '(unset)'}`)
  log(`agentPassword:   ${mask(config.agentPassword)}`)
  log(`ollamaBaseUrl:   ${config.ollamaBaseUrl || '(unset)'}`)
  log(`ollamaModel:     ${config.ollamaModel || '(unset)'}`)
  log(`codeRoot:        ${config.codeRoot || '(unset — prompt-only)'}`)
  log(`maxContextFiles: ${config.maxContextFiles}`)
  log(`maxFileBytes:    ${config.maxFileBytes}`)
  log(`maxContextBytes: ${config.maxContextBytes}`)
  log(`pollIntervalMs:  ${config.pollIntervalMs}`)
  log(`taskTimeoutMs:   ${config.taskTimeoutMs}`)
  if (missing.length) log(`missing env:     ${missing.join(', ')}`)
  log('--- planned steps (per task) ---')
  log('1. POST /auth/login                       -> cache JWT')
  log('2. GET  /agent-tasks                       -> find first status=NEW')
  log('3. PATCH /agent-tasks/:id/status {IN_PROGRESS}')
  log('4. select files + load code context (CODE_ROOT, read-only)')
  log('5. read-only Ollama analysis of task + context (local model)')
  log('6. PATCH /agent-tasks/:id/result {manifest + redacted text}')
  log('7. PATCH /agent-tasks/:id/status {DONE | FAILED}')
}

/** Fast Context Mode plan → (selection, context) for prompt building.
 *  Empty (prompt-only) when CODE_ROOT is unset. */
async function buildPlanned(
  config: Config,
  task: AgentTask,
  secrets: string[],
): Promise<{ plan: ContextPlan | null; context: LoadedContext; selection: SelectionResult }> {
  if (!config.codeRoot) {
    return { plan: null, context: EMPTY_CONTEXT, selection: EMPTY_SELECTION }
  }
  const plan = await planContext(config, task, secrets)
  const context = planToContext(plan)
  const selection: SelectionResult = {
    selected: context.files.map((f) => f.path),
    details: [],
    matchedGroups: plan.profileId ? [plan.profileId] : [],
    mode: plan.selectionMode === 'profile' ? 'keyword' : plan.selectionMode,
    totalCandidates: plan.candidates,
  }
  return { plan, context, selection }
}

async function processOne(client: SmaClient, config: Config, task: AgentTask): Promise<void> {
  const secrets = secretValues(config)
  log(`claiming task ${task.id} ("${task.title}")`)
  await client.setStatus(task.id, 'IN_PROGRESS')

  try {
    const { plan, context, selection } = await buildPlanned(config, task, secrets)
    if (plan) {
      log(
        `context: profile=${plan.profileId ?? '(none)'} mode=${plan.selectionMode} ` +
          `full=${plan.fullFiles.length} summary=${plan.summaryFiles.length} bytes=${context.totalBytes} ` +
          `skipped=${plan.skipped.length} cache(hit=${plan.cacheHits},miss=${plan.cacheMisses}) ` +
          `index=${plan.indexFromCache ? 'cache' : 'built'} planMs=${plan.planMs}`,
      )
    } else {
      log('context: prompt-only (CODE_ROOT unset)')
    }
    const built = buildPrompt(task, selection, context, { codeCommit: null })
    const messages: BuiltMessages = { system: built.system, prompt: built.prompt }

    const result = await runAnalysis(config, messages)
    const footer = `\n\n---\n_generated by agent-runner (read-only V1) · model: ${result.model}_`
    const safe = redact(`${built.manifest}\n\n${result.text}${footer}`, secrets)
    await client.setResult(task.id, safe)
    await client.setStatus(task.id, 'DONE')
    log(`task ${task.id} -> DONE`)
  } catch (err: any) {
    const message = redact(`Execution failed: ${err?.message || String(err)}`, secrets)
    try {
      await client.setResult(task.id, message)
      await client.setStatus(task.id, 'FAILED')
      log(`task ${task.id} -> FAILED (${err?.message || 'error'})`)
    } catch (reportErr: any) {
      log(`task ${task.id}: could not report failure: ${reportErr?.message || reportErr}`)
    }
  }
}

/** Preview context selection for a sample task without calling the model or
 *  touching any AgentTask. The sample task comes from --task / DRY_RUN_TASK. */
async function dryRunContextPreview(config: Config, argv: string[]): Promise<void> {
  if (!config.codeRoot) {
    log('context preview: CODE_ROOT not set — context disabled (prompt-only).')
    return
  }
  const promptText = getArg(argv, '--task') || process.env.DRY_RUN_TASK ||
    'Аудит модуля заявок (tickets): архитектура, риски, рекомендации.'
  const sample: AgentTask = {
    id: 'dry-run', companyId: 'dry-run', title: 'dry-run preview',
    prompt: promptText, status: 'NEW', createdAt: '', updatedAt: '',
  }
  log(`--- context plan (sample task) ---`)
  log(`sample task: ${promptText}`)
  const plan = await planContext(config, sample, secretValues(config))
  log(`module profile:  ${plan.profileId ?? '(none — token fallback)'}`)
  log(`selection mode:  ${plan.selectionMode}, candidates: ${plan.candidates}`)
  log(`project index:   ${plan.indexFromCache ? 'loaded from cache' : 'rebuilt'}`)
  log(`summary cache:   hits=${plan.cacheHits} misses=${plan.cacheMisses}`)
  log(`context planning time: ${plan.planMs} ms`)
  log(`files read FULLY (${plan.fullFiles.length}):`)
  for (const f of plan.fullFiles) log(`   ${f.path}${f.truncated ? ' (truncated)' : ''} [${f.bytes}B]`)
  if (plan.summaryFiles.length) {
    log(`files via SUMMARY (${plan.summaryFiles.length}):`)
    for (const s of plan.summaryFiles) log(`   ${s.path} — ${s.fromCache ? 'cache' : 'computed'}`)
  }
  if (plan.skipped.length) {
    log(`skipped (${plan.skipped.length}):`)
    for (const s of plan.skipped) log(`   ${s.path} — ${s.reason}`)
  }
  log('(no model call, no AgentTask access)')
}

async function liveLoop(config: Config): Promise<void> {
  const client = new SmaClient(config)
  await client.login()
  log('authenticated')

  let stopping = false
  process.on('SIGINT', () => {
    log('SIGINT received — finishing current cycle then exiting')
    stopping = true
  })

  do {
    try {
      const tasks = await client.listTasks()
      const next = tasks
        .filter((t) => t.status === 'NEW')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]

      if (next) {
        await processOne(client, config, next)
      } else {
        log('no NEW tasks')
      }
    } catch (err: any) {
      log(`cycle error: ${err?.message || err}`)
    }

    if (config.once || stopping) break
    await new Promise((r) => setTimeout(r, config.pollIntervalMs))
  } while (!stopping)
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const { config, missing, baseUrlAllowed, baseUrlReason } = loadConfig(argv)

  printPlan(config, missing, baseUrlReason)

  if (config.mode === 'dry-run') {
    await dryRunContextPreview(config, argv)
    log('dry-run: no network calls, no task mutations performed. Use --live to run for real.')
    return
  }

  // live mode hard preconditions
  if (!baseUrlAllowed) {
    log(`refusing to run live: ${baseUrlReason}`)
    process.exitCode = 1
    return
  }
  if (missing.length) {
    log(`refusing to run live: missing required env: ${missing.join(', ')}`)
    process.exitCode = 1
    return
  }

  log('LIVE mode')
  await liveLoop(config)
}

main().catch((err) => {
  console.error(`[agent-runner] fatal: ${err?.message || err}`)
  process.exitCode = 1
})
