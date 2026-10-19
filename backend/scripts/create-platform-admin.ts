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

  let company = await prisma.company.findFirst({
    where: { name: companyName },
    select: { id: true },
  })
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: companyName,
        type: CompanyType.PROVIDER,
        timezone,
        publicRequestEnabled: false,
        publicRequestToken: null,
        publicRequestIntro: null,
      },
      select: { id: true },
    })
    console.log(`[create-platform-admin] created company: ${companyName}`)
  } else {
    console.log(`[create-platform-admin] using company: ${companyName}`)
  }

  await prisma.user.create({
    data: {
      companyId: company.id,
      email,
      password: passwordHash,
      firstName: firstName || 'Platform',
      lastName: lastName || 'Admin',
      avatarUrl: null,
      role: UserRole.PLATFORM_ADMIN,
      isActive: true,
    },
  })
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
