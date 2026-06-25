export type ToolResponse = {
  ok: boolean
  output: Record<string, unknown>
  error: string | null
  elapsedMs: number
  completedAt: string
  mock: true
}

export function createMockToolResponse(params: {
  requestId: string
  employeeId: string
  action: string
  provider: string
  args: Record<string, unknown>
  forceError?: boolean
}): ToolResponse {
  const elapsedMs = 500 + Math.floor(Math.random() * 2500)
  const shouldFail = Boolean(params.forceError)

  if (shouldFail) {
    return {
      ok: false,
      output: {
        requestId: params.requestId,
        provider: params.provider,
      },
      error: `Mock execution failed for action "${params.action}"`,
      elapsedMs,
      completedAt: new Date().toISOString(),
      mock: true,
    }
  }

  return {
    ok: true,
    output: {
      requestId: params.requestId,
      employeeId: params.employeeId,
      action: params.action,
      provider: params.provider,
      args: params.args,
      message: 'Mock provider executed request locally.',
    },
    error: null,
    elapsedMs,
    completedAt: new Date().toISOString(),
    mock: true,
  }
}
