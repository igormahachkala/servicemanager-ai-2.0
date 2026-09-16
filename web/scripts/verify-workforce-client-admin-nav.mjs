/**
 * SMA-CLIENT-ADMIN-WORKFORCE-READ-PARITY-117T
 *
 * Навигация и действия раздела Workforce на десктопе: CLIENT_ADMIN попадает
 * в раздел ссылкой, но не видит управляющих кнопок, которых бэкенд ему не даст.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(resolve(root, rel), 'utf8')

const shell = read('src/ui/Shell.tsx')
const workforcePage = read('src/views/WorkforcePage.tsx')
const matrixPage = read('src/views/WorkforceMatrixPage.tsx')

const checks = []
const check = (name, fn) => { fn(); checks.push(name) }

function workforceNavRule() {
  const at = shell.indexOf("item.to === '/workforce'")
  assert.ok(at > -1, 'нет правила видимости раздела Workforce')
  return shell.slice(at, shell.indexOf('}', at))
}

check('CLIENT_ADMIN видит раздел «Смены и трудозатраты»', () => {
  assert.match(workforceNavRule(), /role === 'CLIENT_ADMIN'/)
})

check('раздел не открыт ролям без доступа', () => {
  const rule = workforceNavRule()
  for (const role of ['TECHNICIAN', 'STAFF']) {
    assert.doesNotMatch(rule, new RegExp(`role === '${role}'`), `${role} не должен видеть раздел`)
  }
  // Обычный CLIENT отсекается раньше — у него свой набор пунктов.
  const clientBranch = shell.slice(shell.indexOf("if (role === 'CLIENT')"), shell.indexOf("item.to === '/workforce'"))
  assert.doesNotMatch(clientBranch, /'\/workforce'/, 'обычному CLIENT раздел не предлагается')
})

check('путь Management → Смены → Табель проходим ссылками', () => {
  assert.match(workforcePage, /to="\/workforce\/matrix"/)
  assert.match(workforcePage, /Табель по месяцу/)
})

check('настройки Workforce остаются только у ADMIN', () => {
  assert.match(workforcePage, /meQ\.data\?\.role === 'ADMIN'/)
})

check('исправление смены не предлагается CLIENT_ADMIN', () => {
  const at = matrixPage.indexOf('CORRECTION_ROLES')
  assert.ok(at > -1)
  const decl = matrixPage.slice(at, matrixPage.indexOf('\n', at))
  assert.doesNotMatch(decl, /CLIENT_ADMIN/, 'CLIENT_ADMIN не правит смены')
  assert.match(matrixPage, /canCorrect/)
})

check('фронтенд не изобретает собственную безопасность', () => {
  // Кнопки скрываются по роли, но запрет остаётся на бэкенде: в клиенте
  // нет ни одной проверки прав, подменяющей ответ сервера.
  assert.doesNotMatch(matrixPage, /WORKFORCE_VIEW/)
  assert.doesNotMatch(workforcePage, /WORKFORCE_VIEW/)
})

console.log(`verify-workforce-client-admin-nav: ${checks.length} проверок пройдено`)
for (const name of checks) console.log(`  ok  ${name}`)
