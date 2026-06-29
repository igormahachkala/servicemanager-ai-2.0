#!/usr/bin/env node
/**
 * AI-COMPANY-067 — end-to-end runtime validation (local dev).
 * Usage: node apps/ai-company/scripts/runtime-e2e-validation.mjs [baseUrl]
 *
 * Requires: dev server on :5174, playwright in .qa-tmp/node_modules
 */
import { createRequire } from 'node:module'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), '../../../.qa-tmp/node_modules/playwright/package.json'),
)
const { chromium } = require('playwright')

const BASE = process.argv[2] || 'http://localhost:5174'
const TASK_TEXT =
  'E2E validation: produce a short planning note for AI Photo Lab MVP with 3 milestones and 2 risks.'

const report = {
  scenario: 'Owner → /ops/run-task → Atlas → Runtime → Task Result → Review',
  baseUrl: BASE,
  at: new Date().toISOString(),
  steps: [],
}

function step(name, status, evidence = {}, problem = null, fix = null, result = null) {
  report.steps.push({ step: name, status, evidence, problem, fix, result })
}

async function readStore(page, key) {
  return page.evaluate((k) => {
    try {
      return JSON.parse(localStorage.getItem(k) || 'null')
    } catch {
      return null
    }
  }, key)
}

async function main() {
  mkdirSync(join(dirname(fileURLToPath(import.meta.url)), '../docs/qa/screenshots'), {
    recursive: true,
  })
  const shotDir = join(dirname(fileURLToPath(import.meta.url)), '../docs/qa/screenshots')

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  try {
    await page.goto(`${BASE}/ops/run-task`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.evaluate(() => {
      localStorage.setItem('ai-company-runtime-active-provider', 'mock')
      localStorage.removeItem('ai-company-task-results-seeded')
    })

    await page.reload({ waitUntil: 'networkidle' })

    const textarea = page.getByRole('textbox', { name: /Task text/i })
    await textarea.fill(TASK_TEXT)
    await page.getByRole('button', { name: 'Atlas', exact: false }).click()
    await page.getByRole('button', { name: 'Planning', exact: false }).click()

    const startBtn = page.getByRole('button', { name: 'Start' })
    await startBtn.click()

    await page.waitForURL(/\/ops\/runtime\/live\?runId=/, { timeout: 120000 })
    const url = page.url()
    const runId = new URL(url).searchParams.get('runId')
    await page.screenshot({ path: join(shotDir, '067-03-runtime-live.png'), fullPage: true })

    const tasks = await readStore(page, 'ai-company-delivery-tasks')
    const task = Array.isArray(tasks)
      ? tasks.find((t) => t.description === TASK_TEXT || t.title?.includes('E2E validation'))
      : null
    step(
      '1. /ops/run-task → delivery task',
      task ? 'PASS' : 'FAIL',
      { taskId: task?.id ?? null, assigneeId: task?.assigneeId ?? null, status: task?.status ?? null },
      task ? null : 'Delivery task not found in localStorage after Start',
    )

    const executions = await readStore(page, 'ai-company-executions')
    const execution = Array.isArray(executions)
      ? executions.find((e) => e.taskId === task?.id || e.runtimeRunId === runId)
      : null
    step(
      '2. Execution Queue',
      execution ? 'PASS' : 'FAIL',
      {
        executionId: execution?.id ?? null,
        status: execution?.status ?? null,
        runtimeRunId: execution?.runtimeRunId ?? null,
      },
      execution ? null : 'Execution record missing for task/run',
    )

    const runs = await readStore(page, 'ai-company-runtime-runs')
    const run = Array.isArray(runs) ? runs.find((r) => r.id === runId) : null
    step(
      '3. Runtime Live',
      run && ['completed', 'running'].includes(run.status) ? 'PASS' : 'FAIL',
      {
        runId,
        status: run?.status ?? null,
        pipelineComplete: run?.pipeline?.find((s) => s.id === 'complete')?.status ?? null,
        elapsedMs: run?.result?.executionDurationMs ?? null,
      },
      run ? null : 'Runtime run not persisted',
    )

    const runHistory = await readStore(page, 'ai-company-run-history')
    const history = Array.isArray(runHistory)
      ? runHistory.find((h) => h.runtimeRunId === runId)
      : null
    step(
      '4. Run History',
      history ? 'PASS' : 'FAIL',
      { historyId: history?.id ?? null, status: history?.status ?? null },
      history ? null : 'Run history entry missing (recordRunHistory)',
    )

    const taskResults = await readStore(page, 'ai-company-task-results')
    const taskResult = Array.isArray(taskResults)
      ? taskResults.find((tr) => tr.runtimeRunId === runId)
      : null
    step(
      '5. Task Results',
      taskResult ? 'PASS' : 'FAIL',
      {
        taskResultId: taskResult?.id ?? null,
        status: taskResult?.status ?? null,
        reportId: taskResult?.reportId ?? null,
      },
      taskResult ? null : 'Task result not created from runtime run',
    )

    const events = await readStore(page, 'ai-company-events')
    const eventTypes = Array.isArray(events)
      ? events.filter((e) => e.sourceId === runId || e.sourceId === taskResult?.id).map((e) => e.type)
      : []
    const hasStarted = events?.some((e) => e.type === 'runtime.started' && e.sourceId === runId)
    const hasCompleted = events?.some(
      (e) =>
        (e.type === 'run.completed' || e.type === 'runtime.completed') && e.sourceId === runId,
    )
    const hasTaskResult = events?.some(
      (e) => e.type === 'task_result.created' && e.sourceId === taskResult?.id,
    )
    step(
      '6. Timeline events',
      hasStarted && hasCompleted && hasTaskResult ? 'PASS' : 'PARTIAL',
      { eventTypes: eventTypes.slice(0, 12), hasStarted, hasCompleted, hasTaskResult },
      !hasTaskResult ? 'task_result.created not emitted (only ready or missing)' : null,
    )

    const notifications = await readStore(page, 'ai-company-notifications')
    const notifCount = Array.isArray(notifications)
      ? notifications.filter(
          (n) =>
            n.eventId &&
            events?.some(
              (e) =>
                e.id === n.eventId &&
                (e.sourceId === runId || e.sourceId === taskResult?.id),
            ),
        ).length
      : 0
    step(
      '7. Notifications',
      notifCount > 0 ? 'PASS' : 'FAIL',
      { linkedNotifications: notifCount },
      notifCount === 0 ? 'No notifications linked to runtime/task_result events' : null,
    )

    await page.goto(`${BASE}/ops/task-results`, { waitUntil: 'networkidle' })
    await page.screenshot({ path: join(shotDir, '067-05-task-results.png'), fullPage: true })
    const reviewVisible = taskResult
      ? await page.locator(`a[href*="${taskResult.id}"], [data-result-id="${taskResult.id}"]`).count()
      : 0
    step(
      '8. Owner Review UI',
      reviewVisible > 0 || (taskResult && (await page.getByText(taskResult.title).count()) > 0)
        ? 'PASS'
        : 'PARTIAL',
      { taskResultId: taskResult?.id ?? null, reviewVisible },
    )

    await page.goto(`${BASE}/ops`, { waitUntil: 'networkidle' })
    const runtimeWidget = await page.getByText(/Runtime/i).count()
    step(
      '9. Command Center widgets',
      runtimeWidget > 0 ? 'PASS' : 'PARTIAL',
      { runtimeWidgetMatches: runtimeWidget, runIdInStorage: runId },
    )

    await page.goto(`${BASE}/ops/projects/project-ai-photo-lab/kickoff`, {
      waitUntil: 'networkidle',
    })
    await page.screenshot({ path: join(shotDir, '067-09-kickoff.png'), fullPage: true })
    const kickoffRuns = await readStore(page, 'ai-company-runtime-runs')
    const kickoffHasRun = Array.isArray(kickoffRuns)
      ? kickoffRuns.some((r) => r.id === runId)
      : false
    step(
      '10. Kickoff state',
      kickoffHasRun ? 'PASS' : 'PARTIAL',
      { kickoffHasRun, runId },
      kickoffHasRun ? null : 'Kickoff snapshot reads runtime runs on mount — verify after navigation',
    )

    report.runId = runId
    report.taskId = task?.id ?? null
    report.taskResultId = taskResult?.id ?? null
    report.overall = report.steps.every((s) => s.status === 'PASS')
      ? 'PASS'
      : report.steps.some((s) => s.status === 'FAIL')
        ? 'FAIL'
        : 'PARTIAL'
  } catch (error) {
    report.fatal = error instanceof Error ? error.message : String(error)
    report.overall = 'FAIL'
    await page.screenshot({ path: join(shotDir, '067-error.png'), fullPage: true }).catch(() => {})
  } finally {
    await browser.close()
  }

  const outJson = join(dirname(fileURLToPath(import.meta.url)), '../docs/qa/runtime-e2e-report.json')
  writeFileSync(outJson, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.overall === 'PASS' ? 0 : 1)
}

main()
