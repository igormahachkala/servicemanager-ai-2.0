import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  BUILD_ASSET_MANIFEST_URL,
  canPromoteShell,
  leftoverFromOtherBuild,
  missingRequired,
  requiredShellUrls,
  type BuildManifest,
} from './appShellPrecache.js'

const manifest: BuildManifest = {
  'index.html': {
    file: 'assets/index-aaa.js',
    isEntry: true,
    css: ['assets/index-aaa.css'],
    assets: ['assets/inter.woff2', 'assets/mozjpeg_enc.wasm'],
    imports: ['_react-vendor-bbb.js', '_api-ccc.js'],
    dynamicImports: [
      'src/mobile/MobileShell.tsx',
      'src/views/BoardPage.tsx',
      'src/it-company/pages/ITCompanyPage.tsx',
      'src/max/MaxApp.tsx',
    ],
  },
  'src/mobile/MobileShell.tsx': {
    file: 'assets/MobileShell-ddd.js',
    css: ['assets/MobileShell-ddd.css'],
    imports: ['_offline-eee.js'],
    dynamicImports: ['src/mobile/MobileTicketPage.tsx', 'src/views/TicketPage.tsx'],
  },
  'src/mobile/MobileTicketPage.tsx': {
    file: 'assets/MobileTicketPage-fff.js',
    imports: ['_api-ccc.js'],
  },
  'src/views/BoardPage.tsx': {
    file: 'assets/BoardPage-ggg.js',
    imports: ['_react-vendor-bbb.js'],
  },
  'src/views/TicketPage.tsx': {
    file: 'assets/TicketPage-hhh.js',
  },
  'src/it-company/pages/ITCompanyPage.tsx': {
    file: 'assets/ITCompanyPage-iii.js',
  },
  'src/max/MaxApp.tsx': {
    file: 'assets/MaxApp-jjj.js',
  },
  '_react-vendor-bbb.js': { file: 'assets/react-vendor-bbb.js' },
  '_api-ccc.js': { file: 'assets/api-ccc.js' },
  '_offline-eee.js': { file: 'assets/offline-eee.js' },
}

test('обязательный набор. entry, /m, шрифт, mobile. без views/it/max/wasm', () => {
  const urls = requiredShellUrls(manifest)
  assert.ok(urls.includes('/index.html'))
  assert.ok(urls.includes('/'))
  assert.ok(urls.includes('/m'))
  assert.ok(urls.includes(BUILD_ASSET_MANIFEST_URL))
  assert.ok(urls.includes('/assets/index-aaa.js'))
  assert.ok(urls.includes('/assets/index-aaa.css'))
  assert.ok(urls.includes('/assets/inter.woff2'))
  assert.ok(urls.includes('/assets/MobileShell-ddd.js'))
  assert.ok(urls.includes('/assets/MobileTicketPage-fff.js'))
  assert.ok(urls.includes('/assets/react-vendor-bbb.js'))
  assert.ok(urls.includes('/assets/api-ccc.js'))
  assert.ok(urls.includes('/assets/offline-eee.js'))
  assert.ok(!urls.includes('/assets/mozjpeg_enc.wasm'))
  assert.ok(!urls.includes('/assets/BoardPage-ggg.js'))
  assert.ok(!urls.includes('/assets/TicketPage-hhh.js'))
  assert.ok(!urls.includes('/assets/ITCompanyPage-iii.js'))
  assert.ok(!urls.includes('/assets/MaxApp-jjj.js'))
})

test('докачка. пропавший URL числится, чужой билд в next распознаётся', () => {
  const required = requiredShellUrls(manifest)
  const have = required.filter((url) => url !== '/assets/MobileTicketPage-fff.js')
  assert.deepEqual(missingRequired(have, required), ['/assets/MobileTicketPage-fff.js'])
  assert.equal(canPromoteShell(have, required), false)
  assert.equal(canPromoteShell(required, required), true)
  assert.equal(leftoverFromOtherBuild(['/assets/old-zzz.js', '/index.html'], required), true)
  assert.equal(leftoverFromOtherBuild(required, required), false)
})

test('SW. next-кэш, отказ install без skipWaiting, index только из боевого кэша', () => {
  const sw = readFileSync(new URL('../../../public/sw.js', import.meta.url), 'utf8')
  const helper = readFileSync(new URL('../../../public/sw-app-shell.js', import.meta.url), 'utf8')
  assert.match(sw, /importScripts\('\/sw-app-shell\.js'\)/)
  assert.match(helper, /sma-app-shell-next/)
  assert.match(helper, /sma-app-shell-v4/)
  assert.match(helper, /precacheApplication/)
  assert.match(helper, /skipWaiting/)
  assert.match(helper, /App shell precache incomplete/)
  assert.match(sw, /live\.match\(APP_SHELL_URL\)|caches\.open\(APP_SHELL_CACHE\).*match\(APP_SHELL_URL\)/s)
  assert.doesNotMatch(helper, /Promise\.all\(urls\.map/)
  assert.match(helper, /\.wasm\$/)
  const nginx = readFileSync(new URL('../../../nginx.conf', import.meta.url), 'utf8')
  assert.match(nginx, /location = \/sw-app-shell\.js/)
})
