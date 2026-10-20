import { NotFoundException, StreamableFile, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { UserRole } from '@prisma/client'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

import { UploadsController } from './uploads.controller'

/**
 * SECURITY P1 — SECURE FILE ACCESS.
 *
 * Аудит: файловые эндпоинты /uploads/* принимали обычный access JWT (7 дней)
 * из query-параметра ?token=. URL утекают в access-логи, прокси, историю
 * браузера и Referer, поэтому полноценный access-токен в URL — утечка.
 *
 * Здесь закреплено поведение после исправления:
 *  - токен принимается ТОЛЬКО из заголовка Authorization: Bearer;
 *  - валидный токен, предъявленный где-либо кроме заголовка, доступа не даёт;
 *  - сохранены: tenant-изоляция (чужой tenant → 404, а не 403/утечка),
 *    отказ без аутентификации (401), просрочка/битый токен (401),
 *    просмотр изображений и скачивание файлов (inline + nosniff),
 *    мобильные вложения (тот же маршрут + Authorization).
 */

const SECRET = 'uploads-p1-test-secret'
const UPLOADS_ROOT = join(process.cwd(), 'uploads')
const PNG = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png'
const PDF = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.pdf'
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const PDF_BYTES = Buffer.from('%PDF-1.4\n%mock\n', 'utf-8')

type Attachment = {
  companyId: string
  mimeType: string
  originalName: string
  ticketId: string | null
  uploadedByUserId: string | null
}

// StreamableFile оборачивает ленивый createReadStream; если его не прочитать,
// открытый дескриптор остаётся висеть. Гасим поток после проверок.
function closeStream(result: unknown) {
  if (result instanceof StreamableFile) result.getStream().destroy()
}

function makeFakeRes() {
  const headers: Record<string, string> = {}
  let statusCode = 200
  const res = {
    set: (keyOrObj: string | Record<string, string>, value?: string) => {
      if (typeof keyOrObj === 'string') headers[keyOrObj] = String(value)
      else for (const [k, v] of Object.entries(keyOrObj)) headers[k] = String(v)
      return res
    },
    status: (code: number) => {
      statusCode = code
      return res
    },
    get headers() {
      return headers
    },
    get statusCode() {
      return statusCode
    },
  }
  return res
}

function makeController(opts: {
  dbUser?: { id: string; email: string; companyId: string; role: UserRole } | null
  attachment?: Attachment | null
}) {
  const jwt = new JwtService({ secret: SECRET })
  const prisma = {
    user: {
      findFirst: jest.fn().mockResolvedValue(opts.dbUser ?? null),
    },
    ticketAttachment: {
      findFirst: jest.fn().mockResolvedValue(opts.attachment ?? null),
    },
  }
  const serviceContracts = {} as never
  const controller = new UploadsController(prisma as never, jwt, serviceContracts)
  return { controller, jwt, prisma }
}

const DB_USER = { id: 'u-1', email: 'u@example.com', companyId: 'co-1', role: UserRole.ADMIN }

function signFor(
  jwt: JwtService,
  user = DB_USER,
  options?: Parameters<JwtService['sign']>[1],
) {
  return jwt.sign(
    { sub: user.id, userId: user.id, companyId: user.companyId, role: user.role },
    options,
  )
}

// Вложение, принадлежащее самому пользователю (ветка без ticketId) — не требует
// подмешивать resolveReadableTicketAccess, проверяет базовую tenant-привязку.
function ownAttachment(mimeType: string, originalName: string): Attachment {
  return {
    companyId: DB_USER.companyId,
    mimeType,
    originalName,
    ticketId: null,
    uploadedByUserId: DB_USER.id,
  }
}

beforeAll(() => {
  mkdirSync(join(UPLOADS_ROOT, 'ticket-attachments'), { recursive: true })
  writeFileSync(join(UPLOADS_ROOT, 'ticket-attachments', PNG), PNG_BYTES)
  writeFileSync(join(UPLOADS_ROOT, 'ticket-attachments', PDF), PDF_BYTES)
})

describe('P1 /uploads — доступ только по заголовку Authorization', () => {
  it('1. авторизованный доступ по заголовку: файл отдаётся', async () => {
    const { controller, jwt } = makeController({
      dbUser: DB_USER,
      attachment: ownAttachment('image/png', 'photo.png'),
    })
    const res = makeFakeRes()
    const result = await controller.serve(
      'ticket-attachments',
      PNG,
      `Bearer ${signFor(jwt)}`,
      undefined,
      undefined,
      undefined,
      res as never,
    )
    expect(result).toBeInstanceOf(StreamableFile)
    expect(res.headers['Content-Type']).toBe('image/png')
    closeStream(result)
  })

  it('2. без заголовка Authorization: 401', async () => {
    const { controller } = makeController({ dbUser: DB_USER })
    const res = makeFakeRes()
    await expect(
      controller.serve('ticket-attachments', PNG, undefined, undefined, undefined, undefined, res as never),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('3. access JWT в URL не принимается: валидный токен вне заголовка доступа не даёт', async () => {
    // В serve() больше нет параметра для query-токена. Даже имея валидный токен,
    // но не в заголовке Authorization, клиент получает 401 — токена в URL нет.
    const { controller, jwt } = makeController({
      dbUser: DB_USER,
      attachment: ownAttachment('image/png', 'photo.png'),
    })
    const validTokenNotInHeader = signFor(jwt)
    expect(validTokenNotInHeader).toBeTruthy()
    const res = makeFakeRes()
    await expect(
      // передаём undefined как Authorization — токен "остался в URL"
      controller.serve('ticket-attachments', PNG, undefined, undefined, undefined, undefined, res as never),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('4. чужой tenant: 404 (а не раскрытие чужого ресурса)', async () => {
    const { controller, jwt } = makeController({
      dbUser: DB_USER,
      attachment: {
        companyId: 'co-OTHER',
        mimeType: 'image/png',
        originalName: 'foreign.png',
        ticketId: null,
        uploadedByUserId: 'u-other',
      },
    })
    const res = makeFakeRes()
    await expect(
      controller.serve('ticket-attachments', PNG, `Bearer ${signFor(jwt)}`, undefined, undefined, undefined, res as never),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('5a. просроченный токен: 401', async () => {
    const { controller, jwt } = makeController({ dbUser: DB_USER })
    const expired = signFor(jwt, DB_USER, { expiresIn: '-10s' })
    const res = makeFakeRes()
    await expect(
      controller.serve('ticket-attachments', PNG, `Bearer ${expired}`, undefined, undefined, undefined, res as never),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('5b. битый / чужой подписью токен: 401', async () => {
    const { controller } = makeController({ dbUser: DB_USER })
    const res = makeFakeRes()
    await expect(
      controller.serve('ticket-attachments', PNG, 'Bearer not-a-real-jwt', undefined, undefined, undefined, res as never),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('5c. неактивный / удалённый пользователь (нет в БД): 401', async () => {
    const { controller, jwt } = makeController({ dbUser: null })
    const res = makeFakeRes()
    await expect(
      controller.serve('ticket-attachments', PNG, `Bearer ${signFor(jwt)}`, undefined, undefined, undefined, res as never),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('6. просмотр изображения: inline + nosniff', async () => {
    const { controller, jwt } = makeController({
      dbUser: DB_USER,
      attachment: ownAttachment('image/png', 'превью.png'),
    })
    const res = makeFakeRes()
    const result = await controller.serve('ticket-attachments', PNG, `Bearer ${signFor(jwt)}`, undefined, undefined, undefined, res as never)
    expect(res.headers['Content-Type']).toBe('image/png')
    expect(res.headers['Content-Disposition']).toMatch(/^inline;/)
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff')
    closeStream(result)
  })

  it('7. скачивание файла: тот же маршрут, корректный mime и имя', async () => {
    const { controller, jwt } = makeController({
      dbUser: DB_USER,
      attachment: ownAttachment('application/pdf', 'договор.pdf'),
    })
    const res = makeFakeRes()
    const result = await controller.serve('ticket-attachments', PDF, `Bearer ${signFor(jwt)}`, undefined, undefined, undefined, res as never)
    expect(result).toBeInstanceOf(StreamableFile)
    expect(res.headers['Content-Type']).toBe('application/pdf')
    expect(res.headers['Content-Disposition']).toContain('filename=')
    closeStream(result)
  })

  it('8. мобильное вложение: тот же эндпоинт + Authorization (blob-fetch) отдаёт файл', async () => {
    // Мобильный клиент грузит вложения тем же authenticated fetch + Blob, что и веб
    // (web/src/lib/api.ts fetchProtectedUploadBlob). Отдельного публичного пути нет.
    const { controller, jwt } = makeController({
      dbUser: DB_USER,
      attachment: ownAttachment('image/png', 'mobile.png'),
    })
    const res = makeFakeRes()
    const result = await controller.serve('ticket-attachments', PNG, `Bearer ${signFor(jwt)}`, undefined, undefined, undefined, res as never)
    expect(result).toBeInstanceOf(StreamableFile)
    closeStream(result)
  })
})

describe('P1 контракт исходника: обычный JWT не читается из query', () => {
  const source = readFileSync(join(__dirname, 'uploads.controller.ts'), 'utf-8')

  it("нет @Query('token') и переменной queryToken", () => {
    expect(source).not.toMatch(/@Query\(/)
    expect(source).not.toMatch(/queryToken/)
  })

  it('resolveUser аутентифицирует только по заголовку Authorization: Bearer', () => {
    const fn = source.slice(source.indexOf('private async resolveUser'))
    const body = fn.slice(0, fn.indexOf('\n  private ', 1))
    expect(body).toMatch(/authHeader\?\.startsWith\('Bearer '\)/)
    expect(body).not.toMatch(/query/i)
  })
})
