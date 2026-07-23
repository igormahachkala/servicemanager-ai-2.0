/**
 * Stage / ops: создать PLATFORM_ADMIN и при необходимости платформенную компанию.
 *
 * Пароль только из окружения (не хардкодить в репозитории).
 * Хеш — bcrypt cost 10, как в AuthService.register / ensurePlatformAdmin.
 *
 * Запуск из контейнера backend (WORKDIR /app):
 *
 *   docker exec -it sma_stage_backend sh -lc '
 *   PLATFORM_ADMIN_EMAIL="admin@stage.local" \
 *   PLATFORM_ADMIN_PASSWORD="CHANGE_ME_STAGE_PASSWORD" \
 *   npx ts-node scripts/create-platform-admin.ts
 *   '
 *
 * Если `npx ts-node` недоступен в образе (npm ci --omit=dev):
 *   - временно: `docker exec ... npm install ts-node typescript --no-save` (не для prod), или
 *   - задать PLATFORM_ADMIN_EMAIL + PLATFORM_ADMIN_PASSWORD в env контейнера и выполнить любой успешный
 *     POST /auth/login с этими учётными данными — AuthService.login вызовет ensurePlatformAdmin() и создаст ту же сущность.
 */

import { PrismaClient, CompanyType, UserRole } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const email = (process.env.PLATFORM_ADMIN_EMAIL || '').trim().toLowerCase()
  const password = (process.env.PLATFORM_ADMIN_PASSWORD || '').trim()
  const firstName = (process.env.PLATFORM_ADMIN_FIRST_NAME || 'Platform').trim()
  const lastName = (process.env.PLATFORM_ADMIN_LAST_NAME || 'Admin').trim()
  const companyName = (process.env.PLATFORM_COMPANY_NAME || 'СМА-Тех').trim()
  const timezone = (process.env.PLATFORM_COMPANY_TIMEZONE || 'UTC').trim() || 'UTC'

  if (!email || !password) {
    // eslint-disable-next-line no-console
    console.error('[create-platform-admin] Set PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD')
    process.exit(1)
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  })
  if (existing) {
    if (existing.role !== UserRole.PLATFORM_ADMIN) {
      // eslint-disable-next-line no-console
      console.error(`[create-platform-admin] Refusing: ${email} already exists as ${existing.role}`)
      process.exit(1)
    }
    // eslint-disable-next-line no-console
    console.log(`[create-platform-admin] Already exists (PLATFORM_ADMIN): ${email}`)
    return
  }

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
    // eslint-disable-next-line no-console
    console.log(`[create-platform-admin] Created company: ${companyName}`)
  } else {
    // eslint-disable-next-line no-console
    console.log(`[create-platform-admin] Using company: ${companyName}`)
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
  // eslint-disable-next-line no-console
  console.log(`[create-platform-admin] Created user: ${email} (PLATFORM_ADMIN)`)
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('[create-platform-admin] failed', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
