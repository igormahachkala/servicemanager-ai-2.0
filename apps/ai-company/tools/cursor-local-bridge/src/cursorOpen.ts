/**
 * Cursor Local Bridge — open task.md / workspace via bundled CLI (AI-COMPANY-113E).
 * Does NOT claim autonomous Cursor execution.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type CursorOpenOutcome = {
  ok: boolean
  exitCode: number
  stdout: string
  stderr: string
  openedTask: boolean
  openedWorkspace: boolean
}

export async function openTaskInCursor(input: {
  cursorBinary: string
  taskFilePath: string
  workspacePath?: string | null
}): Promise<CursorOpenOutcome> {
  let openedTask = false
  let openedWorkspace = false
  let lastExitCode = 0
  let stdout = ''
  let stderr = ''

  if (input.workspacePath) {
    try {
      const workspaceResult = await execFileAsync(input.cursorBinary, [input.workspacePath], {
        timeout: 15_000,
      })
      openedWorkspace = true
      stdout += workspaceResult.stdout
      stderr += workspaceResult.stderr
      lastExitCode = 0
    } catch (error) {
      const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number }
      stdout += err.stdout ?? ''
      stderr += err.stderr ?? String(err.message ?? error)
      lastExitCode = typeof err.code === 'number' ? err.code : 1
    }
  }

  try {
    const taskResult = await execFileAsync(
      input.cursorBinary,
      ['-g', `${input.taskFilePath}:1`],
      { timeout: 15_000 },
    )
    openedTask = true
    stdout += taskResult.stdout
    stderr += taskResult.stderr
    lastExitCode = 0
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number }
    stdout += err.stdout ?? ''
    stderr += err.stderr ?? String(err.message ?? error)
    lastExitCode = typeof err.code === 'number' ? err.code : 1
  }

  return {
    ok: openedTask || openedWorkspace,
    exitCode: lastExitCode,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
    openedTask,
    openedWorkspace,
  }
}
