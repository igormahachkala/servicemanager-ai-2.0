// Моки API для браузерной проверки навигации заявок (TUX-01…04).
// Провайдерская изоляция строже сервера: заявка клиента без
// linkedClientCompanyId=<клиент> отдаёт 404 (сервер PRIMARY-поставщику сам
// ищет договор). Так набор ловит ссылки, потерявшие область.
const now = new Date('2026-10-23T08:00:00Z').toISOString()

function card(i, owner) {
  return {
    id: `t-${i}`, ticketNumber: 1000 + i, companyId: owner, title: `Заявка ${i}`,
    status: i % 5 === 0 ? 'AWAITING_ACCEPTANCE' : 'NEW', urgency: 'NORMAL', priority: 'NORMAL',
    createdAt: now, slaDueAt: null, slaBreached: false, isChild: false, pointName: null,
    location: { id: 'loc-1', name: 'Объект Альфа' }, equipment: null, category: { id: 'cat-1', name: 'Электрика' },
    assignedTechnician: null, assignedTechnicianId: null, description: 'Описание', requesterName: 'Иван',
    createdByUserId: 'u1', createdByUser: { id: 'u1', email: 'a@test.local' },
    lastActivityAt: now, commentsCount: 1,
  }
}

function runItem(i, ticketId) {
  return {
    id: `item-${i}`, runId: 'run-1', title: `Пункт ${i}`, sortOrder: i, zoneName: null, zoneSortOrder: 0, checkpointSortOrder: i,
    responseType: 'BOOLEAN', isRequired: true, status: ticketId ? 'ISSUE' : 'OK', requiresRepair: !!ticketId, booleanValue: !ticketId,
    comment: null, ticketId: ticketId || null, createdAt: now, updatedAt: now,
    ticket: ticketId ? { id: ticketId, ticketNumber: 1000 + Number(ticketId.slice(2)), status: 'NEW', urgency: 'NORMAL', createdAt: now, problemText: 'Найдено' } : null,
    attachments: [],
  }
}

function makeWorld(opts) {
  const owner = opts.ticketOwner || opts.me.companyId
  const cards = Array.from({ length: 60 }, (_, i) => card(i + 1, owner))
  const items = Array.from({ length: 30 }, (_, i) => runItem(i + 1, i % 6 === 2 ? `t-${i + 1}` : null))
  const run = {
    id: 'run-1', companyId: opts.runCompany || opts.me.companyId, templateId: 'tpl-1', locationId: 'loc-1', title: 'Обход Альфа',
    status: 'COMPLETED', reportStatus: 'DRAFT', createdAt: now, updatedAt: now, completedAt: now,
    template: { id: 'tpl-1', name: 'Шаблон' }, performedBy: { id: 'u1', email: 'a@test.local' },
    location: { id: 'loc-1', clientCompanyId: owner, name: 'Объект Альфа' }, equipment: null, items,
  }
  return { owner, cards, run }
}

function body(world, pathname, search, me, company) {
  if (pathname === '/auth/me') return me
  if (pathname === '/health') return { status: 'ok', ok: true }
  if (pathname === '/company') return company
  if (pathname === '/max/binding') return { binding: { id: 'b-1', userId: me.id } }
  if (/linked-clients/.test(pathname)) {
    if (world.owner === me.companyId) return []
    return [{
      id: 'contract-1', status: 'ACTIVE', role: 'PRIMARY', locationMode: 'ALL', effectiveLocationScope: { mode: 'tenant_wide', locationIds: [] },
      createdAt: now, updatedAt: now, locations: [],
      clientCompany: { id: world.owner, name: 'Клиент Один', type: 'CLIENT' }, providerCompany: { id: me.companyId, name: 'Провайдер', type: 'PROVIDER' },
      summary: { openTickets: 60, locations: 1, publicRequestEnabled: false },
    }]
  }
  const providerNeedsScope = world.owner !== me.companyId && me.role !== 'PLATFORM_ADMIN'
  const scoped = search.get('linkedClientCompanyId') === world.owner || search.get('companyId') === world.owner
  if (pathname === '/tickets/board') {
    const cards = providerNeedsScope && !scoped ? [] : world.cards
    const by = (s) => cards.filter((c) => c.status === s)
    return {
      columns: ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_ACCEPTANCE', 'DONE', 'CANCELED'].map((s) => ({ status: s, total: by(s).length, sla: { breached: 0, atRisk: 0 }, cards: by(s) })),
      meta: { totalTickets: cards.length, atRiskThresholdMinutes: 60, limitedToLast: 120, visibilityMode: 'tenant' },
    }
  }
  if (pathname === '/tickets/analytics/context') return { byLocation: [], byEquipment: [], meta: { totalTickets: world.cards.length } }
  if (pathname === '/notifications') {
    return { items: Array.from({ length: 30 }, (_, i) => ({ id: `n-${i}`, type: 'ticket.assigned', title: `Уведомление ${i}`, message: `Заявка №${1001 + i}`, createdAt: now, readAt: now, entityType: 'Ticket', entityId: `t-${i + 1}`, linkedClientCompanyId: world.owner !== me.companyId ? world.owner : null })), unreadCount: 0 }
  }
  if (pathname === '/inspection/runs/run-1') return world.run
  if (pathname === '/inspection/runs/run-1/report') {
    return {
      run: { id: 'run-1', title: 'Обход Альфа', status: 'COMPLETED', startedAt: now, completedAt: now, performedBy: world.run.performedBy, template: world.run.template, location: { id: 'loc-1', name: 'Объект Альфа' }, equipment: null },
      document: { title: 'Акт', number: '1', date: now, executorCompany: { id: world.run.companyId, name: 'Исполнитель' }, clientCompany: { id: world.owner, name: 'Клиент Один' } },
      reportMeta: { status: 'DRAFT' },
      items: world.run.items.map((it) => ({ ...it, ticket: it.ticket ? { id: it.ticket.id, ticketNumber: it.ticket.ticketNumber, status: 'NEW', problemText: 'Найдено' } : null })),
      summary: { totalItems: 30, okCount: 25, issueCount: 5, criticalCount: 0, repairRequiredCount: 5, createdTicketsCount: 5 },
    }
  }
  const m = pathname.match(/^\/tickets\/(t-\d+)$/)
  if (m) {
    if (providerNeedsScope && !scoped) return { __status: 404, message: 'Ticket not found' }
    const c = world.cards.find((x) => x.id === m[1]) || card(1, world.owner)
    return {
      ...c, problemCategory: { id: 'cat-1', name: 'Электрика', instructions: null }, problemText: 'Не работает свет', requesterPhone: null,
      address: null, slaMinutes: null, slaBreachedAt: null, updatedAt: now, children: [], parent: null, meta: { availableActions: {} },
    }
  }
  if (/assignment-candidates|candidates/.test(pathname)) return { currentAssigneeId: null, matched: [], others: [], items: [] }
  if (/timeline/.test(pathname)) return { timeline: [], items: [] }
  if (/problem-categories/.test(pathname)) return [{ id: 'cat-1', name: 'Электрика' }]
  return []
}

/**
 * opts: { me, company, ticketOwner?, runCompany?, delayMs?, delayPaths?: RegExp, log?: string[] }
 */
async function installMocks(ctx, opts) {
  const world = makeWorld(opts)
  const company = opts.company || { id: opts.me.companyId, name: 'Компания', type: 'CLIENT' }
  await ctx.route('http://mock.api/**', async (route) => {
    const u = new URL(route.request().url())
    const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: h })
    if (opts.log) opts.log.push(`${route.request().method()} ${u.pathname}${u.search}`)
    if (opts.delayMs && (!opts.delayPaths || opts.delayPaths.test(u.pathname))) await new Promise((r) => setTimeout(r, opts.delayMs))
    const b = body(world, u.pathname, u.searchParams, opts.me, company)
    const status = b && b.__status ? b.__status : 200
    await route.fulfill({ status, contentType: 'application/json', headers: h, body: JSON.stringify(b) })
  })
  await ctx.route(/st\.max\.ru|max\.ru\/.*\.js/, (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }))
  await ctx.routeWebSocket(/.*/, () => {})
  return world
}

module.exports = { installMocks }
