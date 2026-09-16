import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')

function loadTsModule(path) {
  const filename = resolve(root, path)
  const output = ts.transpileModule(read(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(output, { module, exports: module.exports }, { filename })
  return module.exports
}

const routes = loadTsModule('src/mobile/mobileRoute.ts')
assert.equal(routes.supportsPersonalNotificationPreferences('/m/settings'), true)
assert.equal(routes.supportsPersonalNotificationPreferences('/max/settings'), false)

const router = read('src/router.tsx')
const mobileSettings = read('src/mobile/MobileSettingsPage.tsx')
const desktopSettings = read('src/views/SettingsPage.tsx')
const compactMobileSettings = mobileSettings.replace(/\s+/g, ' ')

assert.match(
  router,
  /path="\/m"[\s\S]*?path="settings" element=\{<LazyRoute component=\{MobileSettingsPage\}/,
  '/m/settings must use MobileSettingsPage',
)
assert.match(
  router,
  /path="\/max"[\s\S]*?path="settings" element=\{<LazyRoute component=\{MobileSettingsPage\}/,
  '/max/settings must keep its existing settings page',
)
assert.match(
  compactMobileSettings,
  /showPersonalNotificationPreferences \? \( <div className="notifPrefMobileWrap"> <NotificationPreferencesPanel \/> <\/div> \) : null/,
  'shared settings page must guard the personal panel by route surface',
)
assert.equal(
  (mobileSettings.match(/<NotificationPreferencesPanel \/>/g) ?? []).length,
  1,
  'shared settings page must not duplicate the personal panel',
)
assert.match(desktopSettings, /<NotificationPreferencesPanel \/>/, 'desktop Settings must keep the personal panel')
assert.doesNotMatch(mobileSettings, /Navigate|\/workspaces|managementHomePath\([^)]*settings/)

console.log('verify-notification-settings-surfaces: 7 checks passed')
