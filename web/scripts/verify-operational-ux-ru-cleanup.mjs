import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const ts = require('typescript')

function source(path) {
  return readFileSync(resolve(root, path), 'utf8')
}

function loadModule(path, dependencies = {}) {
  const filename = resolve(root, path)
  const output = ts.transpileModule(source(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: filename,
  }).outputText.replace(/import\.meta\.env\.DEV/g, 'false')
  const module = { exports: {} }
  vm.runInContext(output, vm.createContext({
    module,
    exports: module.exports,
    require: (id) => {
      if (id in dependencies) return dependencies[id]
      throw new Error(`Unexpected runtime require(${id}) from ${path}`)
    },
    console,
    navigator: { onLine: true },
  }), { filename })
  return module.exports
}

const rolePresentation = loadModule('src/lib/resolveAdminProfile.ts')
const expectedRoles = {
  ADMIN: 'Администратор',
  CLIENT_ADMIN: 'Администратор клиента',
  NETWORK_DIRECTOR: 'Сетевой директор',
  TERRITORIAL_MANAGER: 'Территориальный менеджер',
  MASTER: 'Мастер',
  DISPATCHER: 'Диспетчер',
  TECHNICIAN: 'Техник',
  CLIENT: 'Клиент',
  STAFF: 'Сотрудник',
  PLATFORM_ADMIN: 'Администратор платформы',
}
for (const [role, label] of Object.entries(expectedRoles)) {
  assert.equal(rolePresentation.getRoleDisplayLabel({ role }), label)
}
assert.equal(rolePresentation.getRoleDisplayLabel({ role: 'ADMIN', companyType: 'CLIENT' }), 'Администратор (клиент)')
assert.equal(rolePresentation.getRoleDisplayLabel({ role: 'ADMIN', companyType: 'PROVIDER' }), 'Администратор (провайдер)')
assert.equal(rolePresentation.getServiceContractRoleDisplayLabel('PRIMARY'), 'Основной подрядчик')
assert.equal(rolePresentation.getServiceContractRoleDisplayLabel('SECONDARY'), 'Дополнительный подрядчик')

const shiftGate = loadModule('src/mobile/mobileShiftGate.ts')
assert.equal(shiftGate.isShiftGateSubjectRole('TECHNICIAN'), true)
assert.equal(shiftGate.isShiftGateSubjectRole('MASTER'), true)
for (const role of ['ADMIN', 'DISPATCHER', 'CLIENT_ADMIN', 'NETWORK_DIRECTOR', 'TERRITORIAL_MANAGER', 'STAFF']) {
  assert.equal(shiftGate.isShiftGateSubjectRole(role), false)
}

class ApiRequestError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
const errors = loadModule('src/mobile/mobileActionErrors.ts', {
  '../lib/api': { ApiRequestError },
  './mobileShiftGate': shiftGate,
})
assert.equal(errors.formatMobileMutationError(new Error('Failed to fetch'), { operation: 'other' }), 'Нет соединения. Попробуйте позже')
assert.equal(errors.formatMobileMutationError(new Error('Internal server exception'), { operation: 'other' }), 'Не удалось выполнить действие')
assert.equal(errors.formatMobileMutationError(new Error('Проверьте выбранный объект.'), { operation: 'other' }), 'Проверьте выбранный объект.')
assert.equal(errors.formatMobileMutationError(new Error('ACTIVE_SHIFT_REQUIRED'), { operation: 'other' }), 'Откройте рабочую смену, чтобы выполнить это действие.')

const homeHeader = source('src/mobile/home/HomeHeader.tsx')
const profile = source('src/mobile/MobileProfile.tsx')
const settings = source('src/mobile/MobileSettingsPage.tsx')
const shiftPage = source('src/mobile/MobileShiftPage.tsx')
const contour = source('src/mobile/ClientContourCard.tsx')
const mobileMyTickets = source('src/mobile/MobileMyTickets.tsx')
const mobileWorkforce = source('src/mobile/MobileWorkforcePage.tsx')
const mobileWorkTimer = source('src/mobile/MobileTicketWorkTimer.tsx')
const mobilePushSettings = source('src/mobile/MobilePushSettingsPage.tsx')
const mobileChats = source('src/mobile/MobileChatsPage.tsx')
const mobileAnalytics = source('src/mobile/MobileAnalytics.tsx')
const mobileOfflineQueue = source('src/mobile/MobileOfflineQueue.tsx')
const maxApp = source('src/max/MaxApp.tsx')
const quickCards = source('src/mobile/home/HomeQuickCards.tsx')

assert.match(homeHeader, /getRoleDisplayLabel/)
assert.match(profile, /getRoleDisplayLabel/)
assert.doesNotMatch(profile, /function roleLabel/)
assert.match(profile, /Электронная почта/)
assert.match(profile, /Системные уведомления о новых событиях/)
assert.doesNotMatch(profile, /Mobile Workspace V1|realtime-события|>Email</)
assert.doesNotMatch(settings, /Mobile Workspace V1/)
assert.match(contour, /getServiceContractRoleDisplayLabel/)
assert.match(profile, /isShiftGateSubjectRole/)
assert.match(shiftPage, /enabled: isShiftSubject/)
assert.match(shiftPage, /Рабочая смена не требуется/)
assert.match(shiftPage, /formatMobileMutationError/)
for (const operationalSurface of [mobileMyTickets, mobileWorkforce, mobileWorkTimer, mobilePushSettings, mobileChats, mobileAnalytics, mobileOfflineQueue]) {
  assert.match(operationalSurface, /formatMobileMutationError/)
}
assert.match(maxApp, /bootstrapState === 'context_unavailable'/)
assert.match(maxApp, /import\.meta\.env\.DEV[\s\S]*start_param:/)
const planningBlock = quickCards.slice(quickCards.indexOf('TODO(mobile-v3)'))
assert.doesNotMatch(planningBlock, /onPlanning|onClick=/)
assert.match(quickCards, /aria-disabled="true"/)
assert.match(quickCards, /Будет доступно позже/)

console.log('verify-operational-ux-ru-cleanup: PASS')
