/**
 * SMA-ROUNDS-UX-PRINT-FRESH-PROD-RECONCILIATION-117D (перенос 116E).
 *
 * Возврат между контурами. Проверяется поведение чистых функций
 * returnToNavigation и то, что экран выбора контура ими пользуется.
 *
 * Поломка, ради которой это закреплено: `returnTo` применялся к любой
 * выбранной карточке. Техник уходил из мобильной версии в управленческую
 * часть, в адресе оставался `returnTo=/m/...`, и выбор «Управленческая
 * часть» возвращал его обратно в мобильную — петля, из которой
 * в управленческую часть не попасть вовсе.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const page = readFileSync(resolve(root, 'src/views/WorkspaceSelectorPage.tsx'), 'utf8')

/**
 * Модуль компилируется настоящим tsc — тем же, что собирает приложение.
 * Снимать типы своими регулярками пробовал: выражение вида
 * `as readonly string[]` их переживает, и проверка начинает падать
 * не на поведении, а на собственной хрупкости. Компилятор надёжнее
 * и новых зависимостей не требует.
 */
const outDir = mkdtempSync(resolve(tmpdir(), 'verify-return-to-'))
try {
  execFileSync(
    process.execPath,
    [
      resolve(root, 'node_modules/typescript/bin/tsc'),
      '--target', 'ES2022',
      '--module', 'ES2022',
      '--moduleResolution', 'bundler',
      '--strict',
      '--outDir', outDir,
      resolve(root, 'src/lib/returnToNavigation.ts'),
    ],
    { stdio: 'pipe' },
  )
} catch (error) {
  console.error(String(error.stdout || '') + String(error.stderr || ''))
  throw new Error('returnToNavigation.ts не компилируется')
}

const mod = await import(pathToFileURL(resolve(outDir, 'returnToNavigation.js')).href)
const { workspaceForInternalPath, returnToForWorkspace, sanitizeInternalAppPath } = mod

assert.equal(typeof workspaceForInternalPath, 'function', 'workspaceForInternalPath экспортируется')
assert.equal(typeof returnToForWorkspace, 'function', 'returnToForWorkspace экспортируется')

// ── разметка путей по контурам ───────────────────────────────────────────────

const mapping = [
  ['/m', 'mobile'],
  ['/m/tickets/abc', 'mobile'],
  ['/m/inspection/run-1?x=1', 'mobile'],
  ['/max', 'mobile'],
  ['/max/tickets/abc', 'mobile'],
  ['/board', 'management'],
  ['/companies', 'management'],
  ['/tickets/abc', 'management'],
  ['/inspection/runs', 'management'],
  ['/workforce', 'management'],
  // Сам экран выбора ничьим не является: возврат на него — вторая петля.
  ['/workspaces', ''],
  // Внешнее и запрещённое отсекает sanitizeInternalAppPath.
  ['https://evil.example/m', ''],
  ['/login', ''],
  ['', ''],
  [null, ''],
]

for (const [path, expected] of mapping) {
  assert.equal(
    workspaceForInternalPath(path),
    expected,
    `${JSON.stringify(path)} → ${JSON.stringify(expected)}`,
  )
}

// ── главный инвариант: чужой returnTo не применяется ─────────────────────────

assert.equal(
  returnToForWorkspace('/m/tickets/abc', 'management'),
  '',
  'мобильный returnTo не применяется к управленческой части — это и была петля',
)
assert.equal(
  returnToForWorkspace('/board', 'mobile'),
  '',
  'управленческий returnTo не применяется к мобильной версии',
)
assert.equal(
  returnToForWorkspace('/m/tickets/abc', 'mobile'),
  '/m/tickets/abc',
  'свой returnTo сохраняется целиком, вместе с путём внутри контура',
)
assert.equal(
  returnToForWorkspace('/board?companyId=1', 'management'),
  '/board?companyId=1',
  'строка запроса своего returnTo не теряется',
)
assert.equal(
  returnToForWorkspace('/max/tickets/abc', 'mobile'),
  '/max/tickets/abc',
  'MAX относится к мобильному контуру',
)
assert.equal(returnToForWorkspace('/workspaces', 'management'), '', 'возврат на экран выбора не применяется')
assert.equal(returnToForWorkspace('/m', ''), '', 'без контура returnTo не применяется')
assert.equal(returnToForWorkspace('', 'mobile'), '', 'пустой returnTo даёт пустой результат')

// IT: путь /it в список разрешённых returnTo не входит, поэтому свой returnTo
// у этого контура невозможен и карточка всегда ведёт на свой домашний путь.
assert.equal(sanitizeInternalAppPath('/it'), '', '/it не является допустимым returnTo')
assert.equal(returnToForWorkspace('/it', 'it'), '')

// ── экран выбора контура действительно этим пользуется ───────────────────────

assert.match(
  page,
  /api\.returnToForWorkspace\(returnTo, ws\.id\)/,
  'resolvePath спрашивает принадлежность returnTo выбранному контуру',
)
assert.doesNotMatch(
  page,
  /if \(returnTo\) return returnTo/,
  'безусловное применение returnTo убрано',
)
assert.match(page, /if \(ws\.id === 'it'\) return ws\.to/, 'поведение IT сохранено')
assert.match(page, /api\.appendScopeToPath\(ws\.to, scope, user\)/, 'scope управленческой части сохранён')

rmSync(outDir, { recursive: true, force: true })

console.log('verify-workspace-return-to: OK')
