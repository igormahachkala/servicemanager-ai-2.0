/**
 * Cursor Local Bridge — bundled CLI detection (AI-COMPANY-113E).
 */

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

export type CursorBinaryDetection = {
  path: string | null
  candidates: string[]
  version: string | null
}

function existsExecutable(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.X_OK)
    return fs.statSync(filePath).isFile()
  } catch {
    return false
  }
}

function homeCursorPath(): string | null {
  const home = process.env.HOME
  if (!home) return null
  return path.join(home, 'Applications/Cursor.app/Contents/Resources/app/bin/cursor')
}

function macBundledPath(): string {
  return '/Applications/Cursor.app/Contents/Resources/app/bin/cursor'
}

function detectFromPath(): string | null {
  try {
    const which = execFileSync('/usr/bin/which', ['cursor'], { encoding: 'utf8' }).trim()
    return which && existsExecutable(which) ? which : null
  } catch {
    return null
  }
}

export function detectCursorBinary(): CursorBinaryDetection {
  const envPath = process.env.CURSOR_CLI_PATH?.trim()
  const candidates = [
    envPath,
    macBundledPath(),
    homeCursorPath(),
    detectFromPath(),
  ].filter((item): item is string => Boolean(item))

  const unique = [...new Set(candidates)]
  const resolved = unique.find((item) => existsExecutable(item)) ?? null

  let version: string | null = null
  if (resolved) {
    try {
      version = execFileSync(resolved, ['--version'], { encoding: 'utf8' }).trim()
    } catch {
      version = null
    }
  }

  return { path: resolved, candidates: unique, version }
}
