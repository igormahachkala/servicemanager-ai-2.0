/**
 * SMA-SECURITY-P1 — обычный вход не создаёт привилегированных пользователей.
 *
 * Проверяется поведением: при полностью настроенных PLATFORM_ADMIN_* в
 * окружении ни один вызов login() не должен приводить к созданию
 * пользователя или компании. Раньше приводил — вызов ensurePlatformAdmin()
 * стоял в login() до проверки пароля.
 */
import { UnauthorizedException } from '@nestjs/common'
import * as bcrypt from 'bcrypt'

import { AuthService } from './auth.service'

const PLATFORM_ENV = {
  PLATFORM_ADMIN_EMAIL: 'platform@example.com',
  PLATFORM_ADMIN_PASSWORD: 'EnvConfiguredSecret',
  PLATFORM_COMPANY_NAME: 'СМА-Тех',
}

function makeService(options: {
  user?: {
    id: string
    email: string
    password: string
    role: string
    companyId: string
    isActive: boolean
    company: { name: string; type: string }
  } | null
}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(options.user ?? null),
      create: jest.fn(),
      update: jest.fn(),
    },
    company: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
  }
  const jwt = { sign: jest.fn().mockReturnValue('signed-token') }
  /* MAX-зависимости в login() не участвуют — передаются пустыми заглушками. */
  const maxIdentity = {}
  const maxBindings = {}
  const service = new AuthService(prisma as any, jwt as any, maxIdentity as any, maxBindings as any)
  return { service, prisma, jwt }
}

describe('login при настроенных PLATFORM_ADMIN_* ничего не создаёт', () => {
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const [key, value] of Object.entries(PLATFORM_ENV)) {
      saved[key] = process.env[key]
      process.env[key] = value
    }
  })

  afterEach(() => {
    for (const key of Object.keys(PLATFORM_ENV)) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
    jest.clearAllMocks()
  })

  it('неизвестный email: отказ и ни одной записи в базу', async () => {
    const { service, prisma } = makeService({ user: null })

    await expect(
      service.login({ email: 'nobody@example.com', password: 'whatever' } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException)

    expect(prisma.user.create).not.toHaveBeenCalled()
    expect(prisma.company.create).not.toHaveBeenCalled()
  })

  it('вход ИМЕННО с настроенными в окружении учётными данными не создаёт admin', async () => {
    /*
     * Это и был рабочий путь эксплуатации: аккаунта нет, но переменные
     * заданы — и вход их «материализовал». Теперь должен быть обычный отказ.
     */
    const { service, prisma } = makeService({ user: null })

    await expect(
      service.login({
        email: PLATFORM_ENV.PLATFORM_ADMIN_EMAIL,
        password: PLATFORM_ENV.PLATFORM_ADMIN_PASSWORD,
      } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException)

    expect(prisma.user.create).not.toHaveBeenCalled()
    expect(prisma.company.create).not.toHaveBeenCalled()
  })

  it('отсутствующий admin не создаётся сам даже после многих попыток', async () => {
    const { service, prisma } = makeService({ user: null })

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        service.login({ email: PLATFORM_ENV.PLATFORM_ADMIN_EMAIL, password: 'x' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException)
    }

    expect(prisma.user.create).not.toHaveBeenCalled()
    expect(prisma.company.create).not.toHaveBeenCalled()
  })

  it('неверный пароль существующего пользователя: отказ без записей', async () => {
    const { service, prisma } = makeService({
      user: {
        id: 'u-1',
        email: 'admin@example.com',
        password: await bcrypt.hash('RealPassword', 10),
        role: 'PLATFORM_ADMIN',
        companyId: 'c-1',
        isActive: true,
        company: { name: 'СМА-Тех', type: 'PROVIDER' },
      },
    })

    await expect(
      service.login({ email: 'admin@example.com', password: 'WrongPassword' } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException)

    expect(prisma.user.create).not.toHaveBeenCalled()
    expect(prisma.company.create).not.toHaveBeenCalled()
  })

  it('существующий admin входит штатно — авторизация не ужесточена', async () => {
    const { service, prisma, jwt } = makeService({
      user: {
        id: 'u-1',
        email: 'admin@example.com',
        password: await bcrypt.hash('RealPassword', 10),
        role: 'PLATFORM_ADMIN',
        companyId: 'c-1',
        isActive: true,
        company: { name: 'СМА-Тех', type: 'PROVIDER' },
      },
    })

    const result: any = await service.login({
      email: 'admin@example.com',
      password: 'RealPassword',
    } as any)

    expect(result.access_token).toBe('signed-token')
    expect(result.user.role).toBe('PLATFORM_ADMIN')
    expect(jwt.sign).toHaveBeenCalled()
    // Успешный вход тоже ничего не создаёт.
    expect(prisma.user.create).not.toHaveBeenCalled()
    expect(prisma.company.create).not.toHaveBeenCalled()
  })

  it('половинная конфигурация окружения не ломает вход для всех', async () => {
    /*
     * Раньше при заданном только одном из двух параметров login() бросал
     * BadRequestException — то есть сломанное окружение превращалось в отказ
     * обслуживания для всех пользователей, причём видимый неаутентифицирован-
     * ному клиенту. Теперь окружение на вход не влияет вовсе.
     */
    delete process.env.PLATFORM_ADMIN_PASSWORD
    const { service } = makeService({
      user: {
        id: 'u-1',
        email: 'user@example.com',
        password: await bcrypt.hash('RealPassword', 10),
        role: 'ADMIN',
        companyId: 'c-1',
        isActive: true,
        company: { name: 'Клиент', type: 'CLIENT' },
      },
    })

    const result: any = await service.login({
      email: 'user@example.com',
      password: 'RealPassword',
    } as any)
    expect(result.access_token).toBe('signed-token')
  })

  it('login не читает PLATFORM_ADMIN_* вовсе: вход работает и без них', async () => {
    for (const key of Object.keys(PLATFORM_ENV)) delete process.env[key]

    const { service } = makeService({
      user: {
        id: 'u-1',
        email: 'user@example.com',
        password: await bcrypt.hash('RealPassword', 10),
        role: 'ADMIN',
        companyId: 'c-1',
        isActive: true,
        company: { name: 'Клиент', type: 'CLIENT' },
      },
    })

    const result: any = await service.login({
      email: 'user@example.com',
      password: 'RealPassword',
    } as any)
    expect(result.access_token).toBe('signed-token')
  })
})
