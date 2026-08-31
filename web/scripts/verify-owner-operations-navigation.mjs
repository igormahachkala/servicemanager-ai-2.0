import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function src(path) {
  return readFileSync(resolve(root, path), 'utf8')
}

const shell = src('src/mobile/MobileShell.tsx')
const router = src('src/router.tsx')
const profile = src('src/mobile/MobileProfile.tsx')
const settings = src('src/mobile/MobileSettingsPage.tsx')
const tour = src('src/mobile/MobileGuidedTour.tsx')
const mobileTicket = src('src/mobile/MobileTicketPage.tsx')
const desktopTicketChat = src('src/components/ticket-page/TicketChatPanel.tsx')
const sw = src('public/sw.js')

const navStart = shell.indexOf('const mobileNavItems: MobileNavItem[] = [')
const navEnd = shell.indexOf('const notificationsHref', navStart)
assert.notEqual(navStart, -1, 'MobileShell must define mobileNavItems')
assert.notEqual(navEnd, -1, 'MobileShell nav block boundary must be found')
const navBlock = shell.slice(navStart, navEnd)

assert.match(
  navBlock,
  /const mobileNavItems: MobileNavItem\[\] = \[\s*\{ id: 'home', label: 'Главная', to: mobileRoot \},\s*\{ id: 'inspection', label: 'Обходы', to: mobilePath\(location\.pathname, '\/inspection'\) \},\s*\{ id: 'create', label: '\+', to: mobilePath\(location\.pathname, '\/create'\) \},\s*\{ id: 'analytics', label: 'Аналитика', to: mobilePath\(location\.pathname, '\/analytics'\) \},\s*\{ id: 'settings', label: 'Настройки', to: mobilePath\(location\.pathname, '\/settings'\) \},\s*\]/s,
  'bottom navigation must be Главная / Обходы / + / Аналитика / Настройки',
)
assert.doesNotMatch(navBlock, /label: 'Заявки'|label: 'Мои заявки'|label: 'Чаты'/, 'old bottom nav labels must not return')
assert.doesNotMatch(navBlock, /\/my|\/chats/, 'bottom nav must not point to /my or /chats')
assert.match(shell, /aria-label="Создать заявку"/, 'center create action must keep canonical create label')
assert.match(shell, /mobilePath\(location\.pathname, '\/create'\)/, 'center create action must keep canonical mobile create route')
assert.match(shell, /aria-label="Личный аккаунт"/, 'top user icon must be the personal account entry')

assert.match(router, /<Route path="create" element=\{<MobileCreateTicket \/>\}/, 'mobile create route must remain')
assert.match(router, /<Route path="tickets\/:id" element=\{<MobileTicketPage \/>\}/, 'mobile ticket deep link route must remain')
assert.match(router, /<Route path="my" element=\{<MobileMyTickets \/>\}/, 'legacy/internal my tickets route must remain reachable')
assert.match(router, /<Route path="chats" element=\{<MobileChatsPage \/>\}/, 'legacy/internal chats route must remain reachable')
assert.match(sw, /\/m\/tickets/, 'service worker must keep mobile ticket deep-link support')

assert.doesNotMatch(profile, /ClientContourCard|canAccessManagementDesktop|Управленческая часть|Смены сотрудников|Статистика заявок/, 'profile must not expose company/system management entries')
assert.match(profile, /Личные данные/, 'profile must show personal account data')
assert.match(profile, /Пароль/, 'profile must include password account surface')
assert.match(profile, /Push-уведомления/, 'profile must keep personal notification preferences')
assert.match(profile, /Выйти/, 'profile must keep logout')

assert.match(settings, /ClientContourCard/, 'settings must own company/client contour switching')
assert.match(settings, /Системные и управленческие разделы/, 'settings must be the system/company management area')
assert.match(settings, /canAccessManagementDesktop/, 'settings must reuse the existing management access helper')
assert.match(settings, /mobilePath\(location\.pathname, '\/inspection'\)/, 'settings must link to mobile rounds/inspection')
assert.match(settings, /mobilePath\(location\.pathname, '\/workforce'\)/, 'settings must link to mobile workforce where allowed')

assert.doesNotMatch(tour, /tickets-nav/, 'guided tour must not depend on removed tickets bottom tab')
assert.match(tour, /target: 'ticket-list'/, 'guided tour must point ticket explanation at the actual home ticket list')

assert.match(mobileTicket, /detailTab === 'chat'/, 'ticket-local mobile chat must remain')
assert.match(mobileTicket, /addTicketComment/, 'ticket-local mobile comments must remain')
assert.match(desktopTicketChat, /export function TicketChatPanel/, 'desktop ticket chat panel must remain')

console.log('owner operations navigation verification: PASS')
