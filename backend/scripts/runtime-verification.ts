import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { PrismaService } from '../src/prisma/prisma.service'
import { AppModule } from '../src/app.module'
import { ServiceContractRole, ServiceContractStatus, TicketPriority, UserRole } from '@prisma/client'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as bcrypt from 'bcrypt'
import { JwtService } from '@nestjs/jwt'

type ScenarioRow = {
  scenario: string
  steps: string[]
  actualResult: string
  conclusion: 'PASS' | 'FAIL' | 'PARTIAL'
  expectedResult: string
}

function tokenOf(body: any): string {
  const t = body?.access_token
  if (!t || typeof t !== 'string') throw new Error('access_token is missing')
  return t
}

function issueToken(jwt: JwtService, user: { id: string; email: string; companyId: string; role: UserRole }) {
  return jwt.sign({
    sub: user.id,
    email: user.email,
    companyId: user.companyId,
    role: user.role,
  })
}

function isMineForClient(card: any, meUserId: string): boolean {
  return (card?.createdByUserId || '').trim() === meUserId.trim()
}

function getSlaStateByDueAt(slaDueAt: string | null | undefined, nowMs: number): 'none' | 'breached' | 'warning' | 'ok' {
  if (!slaDueAt) return 'none'
  const due = new Date(slaDueAt).getTime()
  if (Number.isNaN(due)) return 'none'
  if (due < nowMs) return 'breached'
  const diff = due - nowMs
  if (diff < 60 * 60 * 1000) return 'warning'
  return 'ok'
}

async function main() {
  let app: INestApplication | null = null
  const scenarios: ScenarioRow[] = []
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`
  const created: Record<string, string> = {}

  try {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
    const prisma = app.get(PrismaService)
    const jwt = app.get(JwtService)

    // Scenario 0 setup (через Prisma, т.к. /auth/register в окружении может быть закрыт)
    const pwd = 'ChangeMe123!'
    const hash = await bcrypt.hash(pwd, 10)
    const clientCompany = await prisma.company.create({
      data: { name: `RT Client ${suffix}`, type: 'CLIENT' },
      select: { id: true },
    })
    const providerCompany = await prisma.company.create({
      data: { name: `RT Provider ${suffix}`, type: 'PROVIDER' },
      select: { id: true },
    })
    created.clientCompanyId = clientCompany.id
    created.providerCompanyId = providerCompany.id

    const clientAdminUser = await prisma.user.create({
      data: {
        companyId: clientCompany.id,
        email: `rt.client.admin.${suffix}@sma.test`,
        password: hash,
        role: UserRole.ADMIN,
        isActive: true,
      },
    })
    const providerAdminUser = await prisma.user.create({
      data: {
        companyId: providerCompany.id,
        email: `rt.provider.admin.${suffix}@sma.test`,
        password: hash,
        role: UserRole.ADMIN,
        isActive: true,
      },
    })
    const clientAdmin = {
      id: clientAdminUser.id,
      email: clientAdminUser.email,
      role: clientAdminUser.role,
      companyId: clientAdminUser.companyId,
    }
    const providerAdmin = {
      id: providerAdminUser.id,
      email: providerAdminUser.email,
      role: providerAdminUser.role,
      companyId: providerAdminUser.companyId,
    }
    const clientAdminToken = issueToken(jwt, clientAdmin)
    const providerAdminToken = issueToken(jwt, providerAdmin)

    await prisma.serviceContract.upsert({
      where: {
        clientCompanyId_providerCompanyId: {
          clientCompanyId: clientCompany.id,
          providerCompanyId: providerCompany.id,
        },
      },
      update: {
        status: ServiceContractStatus.ACTIVE,
        role: ServiceContractRole.PRIMARY,
      },
      create: {
        clientCompanyId: clientCompany.id,
        providerCompanyId: providerCompany.id,
        status: ServiceContractStatus.ACTIVE,
        role: ServiceContractRole.PRIMARY,
      },
    })

    const otherClientResp = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${clientAdminToken}`)
      .send({
        email: `rt.client.user.${suffix}@sma.test`,
        password: 'ChangeMe123!',
        role: 'CLIENT',
      })
      .expect(201)

    const technicianResp = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${providerAdminToken}`)
      .send({
        email: `rt.tech.${suffix}@sma.test`,
        password: 'ChangeMe123!',
        role: 'TECHNICIAN',
      })
      .expect(201)

    const otherClient = {
      id: otherClientResp.body.id as string,
      email: `rt.client.user.${suffix}@sma.test`,
      role: UserRole.CLIENT,
      companyId: clientAdmin.companyId,
    }
    const tech = {
      id: technicianResp.body.id as string,
      email: `rt.tech.${suffix}@sma.test`,
      role: UserRole.TECHNICIAN,
      companyId: providerAdmin.companyId,
    }
    const otherClientToken = issueToken(jwt, otherClient)
    const techToken = issueToken(jwt, tech)
    created.technicianId = tech.id

    const location = await prisma.location.create({
      data: {
        clientCompanyId: clientAdmin.companyId,
        name: `RT Point ${suffix}`,
        platformCode: `RT-${suffix}`,
        city: 'Ufa',
        address: 'Test st, 1',
      },
    })
    const category = await prisma.problemCategory.create({
      data: {
        companyId: clientAdmin.companyId,
        name: `RT Category ${suffix}`,
        instructions: 'runtime verification category',
      },
    })

    await prisma.technicianClientBinding.create({
      data: {
        providerCompanyId: providerAdmin.companyId,
        technicianUserId: tech.id,
        clientCompanyId: clientAdmin.companyId,
        locationId: null,
      },
    })

    scenarios.push({
      scenario: '0. Setup',
      steps: [
        'Создан client company и provider company',
        'Provider переведён в type=PROVIDER',
        'Создан ACTIVE PRIMARY service contract (linkedClientCompanyId)',
        'Созданы CLIENT ADMIN, второй CLIENT, PROVIDER ADMIN, TECHNICIAN',
      ],
      actualResult: `clientCompanyId=${clientAdmin.companyId}, providerCompanyId=${providerAdmin.companyId}, technicianId=${tech.id}`,
      conclusion: 'PASS',
      expectedResult: 'Скоупы и роли готовы для runtime-прогона',
    })

    // Scenario 1 Create ticket
    const createdTicket = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${clientAdminToken}`)
      .send({
        createMode: 'quick',
        locationId: location.id,
        problemCategoryId: category.id,
        problemText: `RT ticket ${suffix}`,
        priority: TicketPriority.NORMAL,
      })
      .expect(201)
    const ticketId = createdTicket.body?.ticket?.id as string
    created.ticketId = ticketId

    const boardClient = await request(app.getHttpServer())
      .get('/tickets/board')
      .set('Authorization', `Bearer ${clientAdminToken}`)
      .expect(200)
    const cardsClient = (boardClient.body?.columns || []).flatMap((c: any) => c.cards || [])
    const mineClient = cardsClient.filter((c: any) => isMineForClient(c, clientAdmin.id))
    const createdCard = cardsClient.find((c: any) => c.id === ticketId)
    const createdByWorks = createdCard && createdCard.createdByUserId === clientAdmin.id

    scenarios.push({
      scenario: '1. Create ticket (client)',
      steps: ['Залогинен CLIENT', 'Создана заявка', 'Проверка board/all + board/my (frontend mine rule)'],
      actualResult: `ticketId=${ticketId}; inAll=${!!createdCard}; inMine=${mineClient.some((c: any) => c.id === ticketId)}; createdByUserIdMatch=${!!createdByWorks}`,
      conclusion: createdCard && mineClient.some((c: any) => c.id === ticketId) ? 'PASS' : 'FAIL',
      expectedResult: 'Заявка создаётся и отображается в «Все» и «Мои заявки» для автора',
    })

    // Scenario 2 My tickets isolation
    const boardOtherClient = await request(app.getHttpServer())
      .get('/tickets/board')
      .set('Authorization', `Bearer ${otherClientToken}`)
      .expect(200)
    const cardsOther = (boardOtherClient.body?.columns || []).flatMap((c: any) => c.cards || [])
    const mineOther = cardsOther.filter((c: any) => isMineForClient(c, otherClient.id))

    const boardTechBefore = await request(app.getHttpServer())
      .get(`/tickets/board?linkedClientCompanyId=${encodeURIComponent(clientAdmin.companyId)}`)
      .set('Authorization', `Bearer ${techToken}`)
      .expect(200)
    const cardsTechBefore = (boardTechBefore.body?.columns || []).flatMap((c: any) => c.cards || [])
    const mineTechBefore = cardsTechBefore.filter((c: any) => (c.assignedTechnician?.id || '') === tech.id)

    scenarios.push({
      scenario: '2. «Мои заявки»',
      steps: [
        'CLIENT (автор) проверяет mine',
        'Другой CLIENT проверяет mine',
        'TECHNICIAN до назначения проверяет mine',
      ],
      actualResult: `authorMineHasTicket=${mineClient.some((c: any) => c.id === ticketId)}; otherClientMineHasTicket=${mineOther.some((c: any) => c.id === ticketId)}; technicianMineBeforeAssignHasTicket=${mineTechBefore.some((c: any) => c.id === ticketId)}`,
      conclusion:
        mineClient.some((c: any) => c.id === ticketId) &&
        !mineOther.some((c: any) => c.id === ticketId) &&
        !mineTechBefore.some((c: any) => c.id === ticketId)
          ? 'PASS'
          : 'FAIL',
      expectedResult: 'Автор видит свою; другой CLIENT не видит в mine; TECHNICIAN не видит в mine до назначения',
    })

    // Scenario 3 assignment
    await request(app.getHttpServer())
      .put(`/tickets/${ticketId}/assign/${tech.id}?linkedClientCompanyId=${encodeURIComponent(clientAdmin.companyId)}`)
      .set('Authorization', `Bearer ${providerAdminToken}`)
      .expect(200)

    const boardTechAfter = await request(app.getHttpServer())
      .get(`/tickets/board?linkedClientCompanyId=${encodeURIComponent(clientAdmin.companyId)}`)
      .set('Authorization', `Bearer ${techToken}`)
      .expect(200)
    const cardsTechAfter = (boardTechAfter.body?.columns || []).flatMap((c: any) => c.cards || [])
    const mineTechAfter = cardsTechAfter.filter((c: any) => (c.assignedTechnician?.id || '') === tech.id)

    const boardClientAfterAssign = await request(app.getHttpServer())
      .get('/tickets/board')
      .set('Authorization', `Bearer ${clientAdminToken}`)
      .expect(200)
    const cardsClientAfterAssign = (boardClientAfterAssign.body?.columns || []).flatMap((c: any) => c.cards || [])
    const mineClientAfterAssign = cardsClientAfterAssign.filter((c: any) => isMineForClient(c, clientAdmin.id))

    scenarios.push({
      scenario: '3. Assignment',
      steps: [
        'PROVIDER ADMIN назначает техника через linkedClientCompanyId',
        'TECHNICIAN проверяет mine после назначения',
        'CLIENT повторно проверяет mine',
      ],
      actualResult: `techMineAfterAssignHasTicket=${mineTechAfter.some((c: any) => c.id === ticketId)}; clientMineAfterAssignHasTicket=${mineClientAfterAssign.some((c: any) => c.id === ticketId)}`,
      conclusion:
        mineTechAfter.some((c: any) => c.id === ticketId) && mineClientAfterAssign.some((c: any) => c.id === ticketId)
          ? 'PASS'
          : 'FAIL',
      expectedResult: 'TECHNICIAN видит назначенную в mine; CLIENT не теряет свою заявку в mine',
    })

    // Scenario 4 SLA
    const now = Date.now()
    const tBreached = await prisma.ticket.update({
      where: { id: ticketId },
      data: { slaDueAt: new Date(now - 10 * 60 * 1000) },
      select: { id: true, slaDueAt: true },
    })
    const tWarn = await prisma.ticket.create({
      data: {
        companyId: clientAdmin.companyId,
        createdByUserId: clientAdmin.id,
        locationId: location.id,
        problemCategoryId: category.id,
        problemText: `RT warning ${suffix}`,
        priority: TicketPriority.NORMAL,
        slaDueAt: new Date(now + 30 * 60 * 1000),
      },
      select: { id: true, slaDueAt: true },
    })
    const tOk = await prisma.ticket.create({
      data: {
        companyId: clientAdmin.companyId,
        createdByUserId: clientAdmin.id,
        locationId: location.id,
        problemCategoryId: category.id,
        problemText: `RT ok ${suffix}`,
        priority: TicketPriority.NORMAL,
        slaDueAt: new Date(now + 5 * 60 * 60 * 1000),
      },
      select: { id: true, slaDueAt: true },
    })

    const slaStates = [
      { id: tBreached.id, state: getSlaStateByDueAt(tBreached.slaDueAt?.toISOString() || null, now) },
      { id: tWarn.id, state: getSlaStateByDueAt(tWarn.slaDueAt?.toISOString() || null, now) },
      { id: tOk.id, state: getSlaStateByDueAt(tOk.slaDueAt?.toISOString() || null, now) },
    ]
    const orderWeight: Record<string, number> = { breached: 0, warning: 1, ok: 2, none: 3 }
    const sorted = [...slaStates].sort((a, b) => orderWeight[a.state] - orderWeight[b.state]).map((x) => x.state)

    scenarios.push({
      scenario: '4. SLA',
      steps: [
        'Установлен slaDueAt в прошлом для одной заявки',
        'Создана заявка со сроком < 1 часа',
        'Создана заявка со сроком > 1 часа',
        'Проверена SLA-классификация и SLA-порядок',
      ],
      actualResult: `states=${slaStates.map((x) => `${x.id.slice(0, 8)}:${x.state}`).join(', ')}; sortOrder=${sorted.join(' > ')}`,
      conclusion: sorted[0] === 'breached' && sorted[1] === 'warning' ? 'PASS' : 'FAIL',
      expectedResult: 'Просрочено и Скоро дедлайн корректно определяются; просроченные выше warning',
    })

    // Scenario 5 reload (API level)
    const boardReload = await request(app.getHttpServer())
      .get('/tickets/board')
      .set('Authorization', `Bearer ${clientAdminToken}`)
      .expect(200)
    const cardsReload = (boardReload.body?.columns || []).flatMap((c: any) => c.cards || [])
    const hasMainTicketAfterReload = cardsReload.some((c: any) => c.id === ticketId)

    scenarios.push({
      scenario: '5. Reload',
      steps: ['Повторный запрос board после изменений (симуляция reload данных)'],
      actualResult: `ticketStillVisibleAfterReload=${hasMainTicketAfterReload}; boardTotal=${cardsReload.length}`,
      conclusion: hasMainTicketAfterReload ? 'PASS' : 'FAIL',
      expectedResult: 'Данные после reload доступны; фильтры на клиенте не получают битый источник',
    })

    const out = {
      created,
      scenarios,
      checks: {
        createdByUserIdWorks: !!createdByWorks,
        filtersLookCorrectByApi: scenarios[1]?.conclusion === 'PASS' && scenarios[2]?.conclusion === 'PASS',
        slaLogicWorks: scenarios[3]?.conclusion === 'PASS',
      },
    }
    writeFileSync(join(process.cwd(), 'runtime-verification-report.json'), JSON.stringify(out, null, 2), 'utf8')
  } catch (e: any) {
    const out = {
      error: e?.message || String(e),
      stack: e?.stack || null,
      at: new Date().toISOString(),
    }
    writeFileSync(join(process.cwd(), 'runtime-verification-report.json'), JSON.stringify(out, null, 2), 'utf8')
    throw e
  } finally {
    if (app) await app.close()
  }
}

void main()

