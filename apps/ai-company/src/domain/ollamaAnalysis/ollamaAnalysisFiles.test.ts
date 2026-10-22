import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { startStateBridgeServer, type StateBridgeServer } from '../../../tools/state-bridge/src/server.ts'
import { createRepoFiles } from '../../../tools/state-bridge/src/repoFiles.ts'
import { loadAnalysisFiles, MAX_ANALYSIS_FILE_CHARS, searchProjectFiles } from './ollamaAnalysisFiles.ts'
import { buildOllamaAnalysisPrompt, contextWindowFor } from './ollamaAnalysisPrompt.ts'

let repo = ''
let state = ''
let server: StateBridgeServer
let base = ''

function write(rel: string, text: string) {
  const abs = path.join(repo, rel)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, text)
}

before(async () => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-'))
  state = fs.mkdtempSync(path.join(os.tmpdir(), 'state-'))
  write('apps/ai-company/src/domain/toolDispatcher/toolDispatcherConfig.ts', 'export const a = 1\n')
  write('apps/ai-company/src/domain/toolDispatcher/index.ts', 'export * from "./toolDispatcherConfig"\n')
  write('README.md', '# readme\n')
  write('node_modules/x/toolDispatcher.js', 'nope')
  write('.git/config', 'nope')
  write('.env', 'SECRET=1')
  write('backend/.env.production', 'SECRET=2')
  write('backend/.env.example', 'KEY=')
  write('certs/server.key', 'nope')
  write('assets/logo.png', 'binary')
  write('big.txt', 'x'.repeat(250 * 1024))
  server = await startStateBridgeServer({ host: '127.0.0.1', port: 0, dataDir: state, repoRoot: repo })
  base = `http://127.0.0.1:${server.port}`
})
after(async () => {
  await server.close()
  fs.rmSync(repo, { recursive: true, force: true })
  fs.rmSync(state, { recursive: true, force: true })
})

describe('repo files (bridge)', () => {
  it('search finds source files, file-name hits first, skips deps/secrets/binaries', async () => {
    const found = await searchProjectFiles('toolDispatcher', { baseUrl: base })
    assert.deepEqual(found, [
      'apps/ai-company/src/domain/toolDispatcher/toolDispatcherConfig.ts',
      'apps/ai-company/src/domain/toolDispatcher/index.ts',
    ])
    assert.deepEqual(await searchProjectFiles('env', { baseUrl: base }), ['backend/.env.example'])
    assert.deepEqual(await searchProjectFiles('logo', { baseUrl: base }), [])
  })

  it('read refuses escapes, dot-dirs, secrets and binaries', () => {
    const files = createRepoFiles(repo)
    for (const bad of ['../etc/passwd', '.git/config', '.env', 'backend/.env.production', 'certs/server.key', 'node_modules/x/toolDispatcher.js', 'assets/logo.png']) {
      assert.throws(() => files.read(bad), undefined, bad)
    }
    assert.equal(files.read('README.md').content, '# readme\n')
    const big = files.read('big.txt')
    assert.equal(big.truncated, true)
    assert.equal(big.content.length, 200 * 1024)
  })
})

describe('loadAnalysisFiles', () => {
  it('reads picked files, marks unreadable ones, respects the budget', async () => {
    const files = await loadAnalysisFiles(['README.md', '.env', 'big.txt', 'apps/ai-company/src/domain/toolDispatcher/index.ts'], { baseUrl: base })
    assert.equal(files[0].content, '# readme\n')
    assert.equal(files[1].content, null)
    assert.match(files[1].error ?? '', /not allowed|not a readable/)
    assert.equal(files[2].truncated, true)
    const total = files.reduce((n, f) => n + (f.content?.length ?? 0), 0)
    assert.ok(total <= MAX_ANALYSIS_FILE_CHARS)
  })

  it('a dead bridge yields unavailable files, not a crash', async () => {
    const files = await loadAnalysisFiles(['README.md'], { baseUrl: 'http://127.0.0.1:1' })
    assert.equal(files[0].content, null)
  })
})

describe('prompt with files', () => {
  it('embeds files and asks for a bigger context window', () => {
    const prompt = buildOllamaAnalysisPrompt({
      title: 'Audit',
      instructions: 'check',
      files: [
        { path: 'a.ts', content: 'export const a = 1' },
        { path: 'b.ts', content: null, error: 'not found' },
      ],
    })
    assert.match(prompt, /PROJECT CONTEXT: 2 file\(s\)/)
    assert.match(prompt, /--- FILE: a\.ts ---\nexport const a = 1\n--- END FILE: a\.ts ---/)
    assert.match(prompt, /--- FILE: b\.ts \(not available: not found\) ---/)
    assert.equal(contextWindowFor('short'), null)
    assert.equal(contextWindowFor('x'.repeat(60_000)), 24576)
    assert.equal(contextWindowFor('x'.repeat(1_000_000)), 65536)
  })

  it('without files the prompt is unchanged', () => {
    assert.match(buildOllamaAnalysisPrompt({ title: 't', instructions: 'i' }), /PROJECT CONTEXT: none was provided/)
  })
})
