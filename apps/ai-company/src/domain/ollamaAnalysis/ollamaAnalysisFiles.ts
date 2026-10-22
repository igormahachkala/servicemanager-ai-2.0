/**
 * Project files for an analysis task, read through the state bridge
 * (`/runtime/state/v1/files/*`, read-only, see tools/state-bridge/src/repoFiles.ts).
 * The run stores only the paths (ToolExecutionRun.fileScope); contents are
 * read when the analysis starts, so a re-run sees the current code.
 */

import type { AnalysisContextFile } from './ollamaAnalysisPrompt'

export const MAX_ANALYSIS_FILES = 8
/** Total characters of file content put into one prompt (~40k tokens). */
export const MAX_ANALYSIS_FILE_CHARS = 120_000

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

function readProcessEnv(key: string): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  return env?.[key]?.trim() || undefined
}

/** Browser: same-origin relay. Headless (scripts): the bridge directly. */
export function resolveFilesBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) return '/runtime/state'
  return readProcessEnv('AI_COMPANY_FILES_URL') ?? 'http://127.0.0.1:17322'
}

export async function searchProjectFiles(
  query: string,
  options: { fetchImpl?: FetchLike; baseUrl?: string } = {},
): Promise<string[]> {
  const doFetch: FetchLike = options.fetchImpl ?? ((i, init) => fetch(i, init))
  const base = options.baseUrl ?? resolveFilesBaseUrl()
  const res = await doFetch(`${base}/v1/files/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error(`file search failed: HTTP ${res.status}`)
  const body = (await res.json()) as { files?: string[] }
  return body.files ?? []
}

export async function loadAnalysisFiles(
  paths: string[],
  options: { fetchImpl?: FetchLike; baseUrl?: string } = {},
): Promise<AnalysisContextFile[]> {
  const doFetch: FetchLike = options.fetchImpl ?? ((i, init) => fetch(i, init))
  const base = options.baseUrl ?? resolveFilesBaseUrl()
  let budget = MAX_ANALYSIS_FILE_CHARS
  const out: AnalysisContextFile[] = []

  for (const path of paths.slice(0, MAX_ANALYSIS_FILES)) {
    try {
      const res = await doFetch(`${base}/v1/files/read?path=${encodeURIComponent(path)}`)
      const body = (await res.json()) as { content?: string; truncated?: boolean; error?: string }
      if (!res.ok || typeof body.content !== 'string') {
        out.push({ path, content: null, error: body.error ?? `HTTP ${res.status}` })
        continue
      }
      let content = body.content
      let truncated = Boolean(body.truncated)
      if (budget <= 0) {
        out.push({ path, content: null, error: 'context budget exhausted by earlier files' })
        continue
      }
      if (content.length > budget) {
        content = content.slice(0, budget)
        truncated = true
      }
      budget -= content.length
      out.push({ path, content, truncated })
    } catch (error) {
      out.push({ path, content: null, error: error instanceof Error ? error.message : String(error) })
    }
  }
  return out
}
