// Сид для run.cjs: клиент с ADMIN, три старые незакрытые заявки, свежая, старая выполненная
// и старая заявка чужой компании. Запуск из корня репозитория: DATABASE_URL=… node web/e2e/stale-tickets-card/seed.cjs
const path = require('node:path')
const backend = path.resolve(__dirname, '../../../backend/node_modules')
const { PrismaClient } = require(path.join(backend, '@prisma/client'))
const bcrypt = require(path.join(backend, 'bcrypt'))
const prisma = new PrismaClient()
const DAY = 24 * 60 * 60 * 1000
async function main() {
  for (const code of ['TICKETS_VIEW', 'TICKETS_STATUS_CHANGE']) {
    const block = await prisma.permissionBlock.upsert({ where: { code }, update: {}, create: { code, name: code } })
    const ex = await prisma.rolePermission.findFirst({ where: { role: 'ADMIN', permissionBlockId: block.id } })
    if (!ex) await prisma.rolePermission.create({ data: { role: 'ADMIN', permissionBlockId: block.id } })
  }
  const tag = process.env.TAG || 'stale'
  const hash = await bcrypt.hash('Passw0rd!', 4)
  const company = async (name, email) => {
    const c = await prisma.company.create({ data: { name: name + ' ' + Date.now(), type: 'CLIENT', autoAssignEnabled: false,
      users: { create: [{ email, password: hash, role: 'ADMIN', firstName: 'Анна', lastName: 'Админ' }] } } })
    const cat = await prisma.problemCategory.create({ data: { companyId: c.id, name: 'Электрика' } })
    const loc = await prisma.location.create({ data: { clientCompanyId: c.id, name: 'ТЦ Север', platformCode: 'qa-' + tag + '-' + Math.random(), isActive: true } })
    return (text, status, ageDays) => prisma.ticket.create({ data: { companyId: c.id, locationId: loc.id, problemCategoryId: cat.id,
      problemText: text, urgency: 'NOT_URGENT', status, createdAt: new Date(Date.now() - ageDays * DAY), ...(status === 'DONE' ? { closedAt: new Date() } : {}) } })
  }
  const mk = await company('QA Клиент', `qa-admin-${tag}@stale.local`)
  const s1 = await mk('Не работает свет в зале', 'NEW', 11)
  const s2 = await mk('Течёт кондиционер', 'IN_PROGRESS', 15)
  const s3 = await mk('Замена лампы у входа', 'AWAITING_ACCEPTANCE', 12)
  await mk('Мигает вывеска', 'NEW', 2)
  await mk('Старая выполненная', 'DONE', 30)
  const foreign = await company('QA Чужой', `qa-foreign-${tag}@stale.local`)
  await foreign('Чужая старая', 'NEW', 20)
  console.log([s1.id, s2.id, s3.id].join(' '))
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
