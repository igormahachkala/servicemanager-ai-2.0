/**
 * SMA-SECURITY-P1 — единственный путь первоначального создания PLATFORM_ADMIN.
 *
 * Раньше ту же сущность мог создать обычный вход: AuthService.login() вызывал
 * ensurePlatformAdmin() до проверки пароля, поэтому любой неаутентифицированный
 * POST /auth/login при настроенных PLATFORM_ADMIN_* создавал привилегированного
 * пользователя и платформенную компанию, а удаление аккаунта не держалось.
 * Этот путь убран. Остался только осознанный операторский запуск — вот этот.
 *
 * Что скрипт НЕ делает:
 *   - не меняет пароль действующего аккаунта;
 *   - не повышает роль существующему пользователю;
 *   - не удаляет и не деактивирует ничего;
 *   - не печатает пароль и не печатает аргументы запросов при ошибке.
 *
 * Повторный запуск безопасен: действующий PLATFORM_ADMIN остаётся как есть.
 *
 * ── Запуск ──────────────────────────────────────────────────────────────────
 *
 * В production-образе devDependencies нет, поэтому ts-node не нужен — скрипт
 * собирается вместе с бэкендом и запускается обычным node:
 *
 *   docker exec -i <backend> sh -lc '
 *     PLATFORM_ADMIN_BOOTSTRAP_CONFIRM=create-platform-admin \
 *     PLATFORM_ADMIN_EMAIL="admin@example.com" \
 *     PLATFORM_ADMIN_PASSWORD="<из защищённого хранилища>" \
 *     node dist/scripts/create-platform-admin.js
 *   '
 *
 * В окружении разработки доступен и ts-node: `npm run platform:admin:create`.
 *
 * Пароль задаётся только через окружение и только на время запуска. Не
 * прописывать его в compose, не оставлять в истории команд (см.
 * docs/PLATFORM_ADMIN_RECOVERY.md — там разобран безопасный ввод).
 */

import { PrismaClient, CompanyType, UserRole } from '@prisma/client'
import * as bcrypt from 'bcrypt'

import {
  BOOTSTRAP_CONFIRM_ENV,
  applyPlatformAdminBootstrap,
  decidePlatformAdminBootstrap,
  describeBootstrapFailure,
} from '../src/auth/platform-admin-bootstrap'

const prisma = new PrismaClient()

/* eslint-disable no-console */

async function main() {
  const email = (process.env.PLATFORM_ADMIN_EMAIL || '').trim().toLowerCase()
  const password = (process.env.PLATFORM_ADMIN_PASSWORD || '').trim()
  const firstName = (process.env.PLATFORM_ADMIN_FIRST_NAME || 'Platform').trim()
  const lastName = (process.env.PLATFORM_ADMIN_LAST_NAME || 'Admin').trim()
  const companyName = (process.env.PLATFORM_COMPANY_NAME || 'СМА-Тех').trim()
  const timezone = (process.env.PLATFORM_COMPANY_TIMEZONE || 'UTC').trim() || 'UTC'
  const confirm = process.env[BOOTSTRAP_CONFIRM_ENV]

  /*
   * Запрос в базу делается только когда есть и подтверждение, и учётные
   * данные: без них решение уже отрицательное, и трогать базу незачем.
   */
  const existingUser =
    confirm && email
      ? await prisma.user.findUnique({
          where: { email },
          select: { id: true, role: true },
        })
      : null

  const decision = decidePlatformAdminBootstrap({ email, password, confirm, existingUser })

  if (decision.action === 'refuse') {
    console.error(`[create-platform-admin] refused: ${decision.reason}`)
    process.exitCode = 1
    return
  }

  if (decision.action === 'noop') {
    console.log(`[create-platform-admin] no changes: ${decision.reason}`)
    return
  }

  // Оператор видит, в какую базу пишет: имя базы не секрет, а ошибиться контуром легко.
  const target = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`
  console.log(`[create-platform-admin] target database: ${target[0]?.db ?? 'unknown'}`)

  const passwordHash = await bcrypt.hash(password, 10)

  /*
   * Создание целиком под консультативной блокировкой.
   *
   * Без неё два одновременных запуска оба не находили платформенную компанию
   * и оба её создавали: уникальности у Company.name в схеме нет. Блокировка
   * снимается вместе с транзакцией, поэтому не залипает при ошибке.
   *
   * Решение ПЕРЕПРОВЕРЯЕТСЯ под блокировкой той же чистой функцией: пока мы
   * ждали, конкурент мог создать администратора, и тогда создавать нельзя —
   * ни второго пользователя, ни второй компании.
   */
  const applied = await prisma.$transaction(async (tx) => {
    /*
     * Связывание настоящей транзакции с узким интерфейсом bootstrap.
     * Вся логика порядка и перепроверки живёт в applyPlatformAdminBootstrap
     * и проверяется тестами; здесь только адаптация.
     */
    return applyPlatformAdminBootstrap(
      {
        lockAdvisory: async (key) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key})`
        },
        findUserByEmail: (value) =>
          tx.user.findUnique({ where: { email: value }, select: { id: true, role: true } }),
        findCompanyByName: (name) =>
          tx.company.findFirst({ where: { name }, select: { id: true } }),
        createCompany: (name) =>
          tx.company.create({
            data: {
              name,
              type: CompanyType.PROVIDER,
              timezone,
              publicRequestEnabled: false,
              publicRequestToken: null,
              publicRequestIntro: null,
            },
            select: { id: true },
          }),
        createUser: async ({ companyId, email: userEmail }) => {
          await tx.user.create({
            data: {
              companyId,
              email: userEmail,
              password: passwordHash,
              firstName: firstName || 'Platform',
              lastName: lastName || 'Admin',
              avatarUrl: null,
              role: UserRole.PLATFORM_ADMIN,
              isActive: true,
            },
          })
        },
      },
      { email, password, confirm, companyName },
    )
  })

  if (applied.action === 'refuse') {
    console.error(`[create-platform-admin] refused: ${applied.reason}`)
    process.exitCode = 1
    return
  }

  if (applied.action === 'noop') {
    // Конкурент успел раньше: это не ошибка, повторный запуск безопасен.
    console.log(`[create-platform-admin] no changes: ${applied.reason}`)
    return
  }

  console.log(
    applied.createdCompany
      ? `[create-platform-admin] created company: ${companyName}`
      : `[create-platform-admin] using company: ${companyName}`,
  )
  console.log(`[create-platform-admin] created user: ${email} (PLATFORM_ADMIN)`)
}

main()
  .catch((e) => {
    /*
     * Только класс и код ошибки. Полный объект Prisma включает аргументы
     * вызова, а среди них поле password с хешем — в журнал оно попасть
     * не должно.
     */
    console.error(`[create-platform-admin] failed: ${describeBootstrapFailure(e)}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
