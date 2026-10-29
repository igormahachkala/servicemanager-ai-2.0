// Сид для run.cjs: клиент с ADMIN (читатель) и CLIENT (автор), две заявки.
// Запуск из корня репозитория: DATABASE_URL=… node web/e2e/ticket-chat-unread/seed.cjs
const path = require('node:path')
const backend = path.resolve(__dirname, '../../../backend/node_modules')
const { PrismaClient } = require(path.join(backend, '@prisma/client'))
const bcrypt = require(path.join(backend, 'bcrypt'))
const prisma = new PrismaClient()
async function main() {
  const block = await prisma.permissionBlock.upsert({ where: { code: 'TICKETS_VIEW' }, update: {}, create: { code: 'TICKETS_VIEW', name: 'TICKETS_VIEW' } })
  for (const role of ['ADMIN', 'CLIENT']) {
    const ex = await prisma.rolePermission.findFirst({ where: { role, permissionBlockId: block.id } })
    if (!ex) await prisma.rolePermission.create({ data: { role, permissionBlockId: block.id } })
  }
  const tag = process.env.TAG || 'chat'
  const hash = await bcrypt.hash('Passw0rd!', 4)
  const c = await prisma.company.create({ data: { name: 'QA Клиент ' + Date.now(), type: 'CLIENT', autoAssignEnabled: false,
    users: { create: [
      { email: `qa-admin-${tag}@chat.local`, password: hash, role: 'ADMIN', firstName: 'Анна', lastName: 'Админ' },
      { email: `qa-client-${tag}@chat.local`, password: hash, role: 'CLIENT', firstName: 'Олег', lastName: 'Клиент' },
    ] } } })
  const cat = await prisma.problemCategory.create({ data: { companyId: c.id, name: 'Электрика' } })
  const loc = await prisma.location.create({ data: { clientCompanyId: c.id, name: 'ТЦ Север', platformCode: 'qa-north-' + Date.now(), isActive: true } })
  const mk = (text) => prisma.ticket.create({ data: { companyId: c.id, locationId: loc.id, problemCategoryId: cat.id, problemText: text, urgency: 'NOT_URGENT', status: 'NEW' } })
  const t1 = await mk('Не работает свет в зале'); const t2 = await mk('Мигает вывеска')
  console.log([t1.id, t2.id].join(' '))
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
