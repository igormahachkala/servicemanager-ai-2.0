/**
 * Execution backend: read-only analysis via a LOCAL Ollama model (e.g. Qwen).
 * No external AI API and no API keys.
 *
 * This is deliberately read-only. It produces a TEXT analysis of the task
 * prompt. It does NOT touch the filesystem, run shell commands, access the
 * repository, push, deploy, or perform any mutation outside writing the
 * resulting text back through the SMA API (done by the caller).
 *
 * Uses streaming (stream:true): Ollama sends response headers and the first
 * NDJSON chunk immediately, so long generations no longer trip Node/undici's
 * default ~300s headers timeout. The overall wall-clock is still bounded by
 * config.taskTimeoutMs via AbortController.
 */

import type { Config } from './config'
import type { AgentTask } from './smaClient'

const SYSTEM_PROMPT = [
  'You are the Engineering Agent executor for ServiceManager.AI, running in READ-ONLY MVP mode.',
  'You receive an engineering task and must produce a clear, actionable WRITTEN analysis.',
  'Strict rules:',
  '- You CANNOT execute code, run shell commands, access a repository, or change any files.',
  '- Do NOT claim to have made changes. Only analyze, plan, and advise.',
  '- Never invent or echo secrets, tokens, passwords, or API keys.',
  '- If the task requires code changes, describe the plan and the proposed diff in prose; do not pretend it was applied.',
  'Output a concise, structured analysis (findings, recommended approach, risks, next steps).',
].join('\n')

export interface ExecutionResult {
  text: string
  model: string
}

/**
 * Run read-only analysis for a task via Ollama's /api/generate with
 * stream:true. Reads the NDJSON stream line by line, concatenates every
 * chunk.response, and stops at the chunk with done:true. Aborts (and reports a
 * timeout) after config.taskTimeoutMs.
 */
export async function runAnalysis(config: Config, task: AgentTask): Promise<ExecutionResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.taskTimeoutMs)

  const prompt = [`Task title: ${task.title}`, '', 'Task prompt:', task.prompt].join('\n')
  const url = config.ollamaBaseUrl.replace(/\/+$/, '') + '/api/generate'

  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined

  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: config.ollamaModel,
        system: SYSTEM_PROMPT,
        prompt,
        stream: true,
        think: false,
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      let msg = `HTTP ${res.status}`
      try {
        msg = JSON.parse(text)?.error || text || msg
      } catch {
        msg = text || msg
      }
      throw new Error(`Ollama API error: ${msg}`)
    }

    if (!res.body) throw new Error('Ollama returned no response body')

    reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let out = ''
    let model = config.ollamaModel
    let done = false

    const handleLine = (line: string) => {
      const trimmed = line.trim()
      if (!trimmed) return
      let chunk: any
      try {
        chunk = JSON.parse(trimmed)
      } catch {
        // Partial/garbled line — skip; complete lines are reassembled via buffer.
        return
      }
      if (chunk.error) throw new Error(`Ollama stream error: ${chunk.error}`)
      if (typeof chunk.response === 'string') out += chunk.response
      if (chunk.model) model = chunk.model
      if (chunk.done) done = true
    }

    while (!done) {
      const { value, done: streamEnded } = await reader.read()
      if (streamEnded) break
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl)
        buffer = buffer.slice(nl + 1)
        handleLine(line)
        if (done) break
      }
    }

    // Flush any trailing line that arrived without a final newline.
    if (!done && buffer.trim()) handleLine(buffer)

    out = out.trim()
    if (!out) throw new Error('Ollama returned an empty response')

    return { text: out, model }
  } catch (err: any) {
    if (err?.name === 'AbortError' || controller.signal.aborted) {
      throw new Error(`Analysis timed out after ${config.taskTimeoutMs}ms`)
    }
    throw err
  } finally {
    clearTimeout(timer)
    try {
      await reader?.cancel()
    } catch {
      // ignore reader cleanup errors
    }
  }
}
