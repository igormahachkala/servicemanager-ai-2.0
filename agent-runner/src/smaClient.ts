/**
 * Thin HTTP client for the ServiceManager.AI Engineering Agent API.
 *
 * Talks to the public REST API only — never the database. All mutating calls
 * go through the same guards/validation as a human owner. The base URL is
 * validated by config (allowlist + production denylist) before this client is
 * ever constructed.
 */

import { checkBaseUrl, type Config } from './config'

export type AgentTaskStatus = 'NEW' | 'IN_PROGRESS' | 'DONE' | 'FAILED'

export interface AgentTask {
  id: string
  companyId: string
  title: string
  prompt: string
  status: AgentTaskStatus
  result?: string | null
  createdAt: string
  updatedAt: string
}

export class SmaClient {
  private token: string | null = null

  constructor(private readonly config: Config) {
    const { allowed, reason } = checkBaseUrl(config.apiBaseUrl)
    if (!allowed) {
      throw new Error(`Refusing to start: ${reason}`)
    }
  }

  private url(path: string): string {
    return this.config.apiBaseUrl.replace(/\/+$/, '') + path
  }

  private async request<T>(path: string, init: RequestInit, retryOn401 = true): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    }
    if (this.token) headers.Authorization = `Bearer ${this.token}`

    const res = await fetch(this.url(path), { ...init, headers })

    if (res.status === 401 && retryOn401 && path !== '/auth/login') {
      // token likely expired — re-login once and retry
      this.token = null
      await this.login()
      return this.request<T>(path, init, false)
    }

    const text = await res.text()
    let body: any = null
    if (text) {
      try {
        body = JSON.parse(text)
      } catch {
        body = text
      }
    }

    if (!res.ok) {
      const msg = body?.message
        ? Array.isArray(body.message)
          ? body.message.join(', ')
          : String(body.message)
        : `HTTP ${res.status}`
      throw new Error(`${init.method || 'GET'} ${path} failed: ${msg}`)
    }

    return body as T
  }

  async login(): Promise<void> {
    const body = await this.request<{ access_token?: string }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email: this.config.agentEmail, password: this.config.agentPassword }),
      },
      false,
    )
    if (!body?.access_token) {
      throw new Error('Login succeeded but no access_token was returned')
    }
    this.token = body.access_token
  }

  listTasks(): Promise<AgentTask[]> {
    return this.request<AgentTask[]>('/agent-tasks', { method: 'GET' })
  }

  getTask(id: string): Promise<AgentTask> {
    return this.request<AgentTask>(`/agent-tasks/${encodeURIComponent(id)}`, { method: 'GET' })
  }

  setStatus(id: string, status: AgentTaskStatus): Promise<AgentTask> {
    return this.request<AgentTask>(`/agent-tasks/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  }

  setResult(id: string, result: string): Promise<AgentTask> {
    return this.request<AgentTask>(`/agent-tasks/${encodeURIComponent(id)}/result`, {
      method: 'PATCH',
      body: JSON.stringify({ result }),
    })
  }
}
