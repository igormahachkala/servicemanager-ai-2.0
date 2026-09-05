import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common'
import { createHash } from 'crypto'

import { PublicRequestSecurityService } from './public-request-security.service'

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function makeService(prismaPartial: any = {}) {
  const prisma = {
    publicRequestLog: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({}),
    },
    ...prismaPartial,
  } as any
  return { svc: new PublicRequestSecurityService(prisma), prisma }
}

// ── normalizeDescription ──────────────────────────────────────────────────────

describe('PublicRequestSecurityService.normalizeDescription', () => {
  const { svc } = makeService()

  it('returns trimmed, collapsed text for valid input', () => {
    expect(svc.normalizeDescription('  hello   world  ')).toBe('hello world')
  })

  it('throws when description is too short (<3 chars)', () => {
    expect(() => svc.normalizeDescription('ab')).toThrow(BadRequestException)
    expect(() => svc.normalizeDescription('')).toThrow(BadRequestException)
  })

  it('throws when description exceeds 2000 chars', () => {
    expect(() => svc.normalizeDescription('a'.repeat(2001))).toThrow(BadRequestException)
  })

  it('accepts exactly 3 and 2000 chars', () => {
    expect(svc.normalizeDescription('abc')).toBe('abc')
    expect(svc.normalizeDescription('a'.repeat(2000))).toHaveLength(2000)
  })
})

// ── normalizeName ─────────────────────────────────────────────────────────────

describe('PublicRequestSecurityService.normalizeName', () => {
  const { svc } = makeService()

  it('returns null for empty / null / undefined input', () => {
    expect(svc.normalizeName(null)).toBeNull()
    expect(svc.normalizeName(undefined)).toBeNull()
    expect(svc.normalizeName('   ')).toBeNull()
  })

  it('trims and collapses whitespace', () => {
    expect(svc.normalizeName('  John  Doe  ')).toBe('John Doe')
  })

  it('truncates to 255 chars', () => {
    expect(svc.normalizeName('a'.repeat(300))).toHaveLength(255)
  })
})

// ── normalizePhone ────────────────────────────────────────────────────────────

describe('PublicRequestSecurityService.normalizePhone', () => {
  const { svc } = makeService()

  it('throws when phone is required but empty', () => {
    expect(() => svc.normalizePhone('', true)).toThrow(BadRequestException)
    expect(() => svc.normalizePhone(undefined, true)).toThrow(BadRequestException)
  })

  it('returns null when phone is optional and empty', () => {
    expect(svc.normalizePhone('', false)).toBeNull()
    expect(svc.normalizePhone(undefined, false)).toBeNull()
  })

  it('replaces Russian 8-prefix with 7', () => {
    expect(svc.normalizePhone('89991234567', false)).toBe('+79991234567')
    expect(svc.normalizePhone('8 999 123-45-67', false)).toBe('+79991234567')
  })

  it('strips non-digits and prepends +', () => {
    expect(svc.normalizePhone('+7 (999) 123-45-67', false)).toBe('+79991234567')
    expect(svc.normalizePhone('1234567890', false)).toBe('+1234567890')
  })

  it('throws when phone has fewer than 10 digits', () => {
    expect(() => svc.normalizePhone('12345', false)).toThrow(BadRequestException)
  })

  it('throws when phone has more than 15 digits', () => {
    expect(() => svc.normalizePhone('1234567890123456', false)).toThrow(BadRequestException)
  })
})

// ── normalizeIp ───────────────────────────────────────────────────────────────

describe('PublicRequestSecurityService.normalizeIp', () => {
  const { svc } = makeService()

  it('returns null for empty / null input', () => {
    expect(svc.normalizeIp(null)).toBeNull()
    expect(svc.normalizeIp('')).toBeNull()
  })

  it('returns single IP as-is', () => {
    expect(svc.normalizeIp('1.2.3.4')).toBe('1.2.3.4')
  })

  it('returns a single address from X-Qrator-IP-Source or req.ip unchanged', () => {
    expect(svc.normalizeIp('203.0.113.10')).toBe('203.0.113.10')
  })

  it('still takes the first token if a leftover comma-separated chain is passed', () => {
    expect(svc.normalizeIp('1.2.3.4, 5.6.7.8, 9.10.11.12')).toBe('1.2.3.4')
  })
})

// ── hash ──────────────────────────────────────────────────────────────────────

describe('PublicRequestSecurityService.hash', () => {
  const { svc } = makeService()

  it('returns null for empty / null input', () => {
    expect(svc.hash(null)).toBeNull()
    expect(svc.hash(undefined)).toBeNull()
    expect(svc.hash('')).toBeNull()
  })

  it('returns sha256 hex of the value', () => {
    expect(svc.hash('abc')).toBe(sha256('abc'))
  })
})

// ── validatePhotos ────────────────────────────────────────────────────────────

describe('PublicRequestSecurityService.validatePhotos', () => {
  const { svc } = makeService()

  const settings = { publicRequestAllowPhotos: true, publicRequestMaxPhotos: 3 }
  const validFile = { mimetype: 'image/jpeg', size: 1024 }

  it('passes for empty files array', () => {
    expect(() => svc.validatePhotos([], settings)).not.toThrow()
  })

  it('passes for valid files within limit', () => {
    expect(() => svc.validatePhotos([validFile, validFile], settings)).not.toThrow()
  })

  it('throws when photos are disabled but files provided', () => {
    expect(() =>
      svc.validatePhotos([validFile], { publicRequestAllowPhotos: false, publicRequestMaxPhotos: 3 }),
    ).toThrow(BadRequestException)
  })

  it('throws when files exceed the max count', () => {
    const tooMany = [validFile, validFile, validFile, validFile]
    expect(() => svc.validatePhotos(tooMany, settings)).toThrow(BadRequestException)
  })

  it('throws for unsupported MIME type', () => {
    expect(() => svc.validatePhotos([{ mimetype: 'application/pdf', size: 1024 }], settings)).toThrow(BadRequestException)
  })

  it('throws for zero-size file', () => {
    expect(() => svc.validatePhotos([{ mimetype: 'image/png', size: 0 }], settings)).toThrow(BadRequestException)
  })

  it('throws for file exceeding 10 MB', () => {
    const tooBig = { mimetype: 'image/jpeg', size: 10 * 1024 * 1024 + 1 }
    expect(() => svc.validatePhotos([tooBig], settings)).toThrow(BadRequestException)
  })

  it('accepts all allowed MIME types', () => {
    const types = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
    for (const mimetype of types) {
      expect(() => svc.validatePhotos([{ mimetype, size: 512 }], settings)).not.toThrow()
    }
  })
})

// ── assertSubmitAllowed ───────────────────────────────────────────────────────

describe('PublicRequestSecurityService.assertSubmitAllowed', () => {
  const base = { companyId: 'co-1', token: 'tok', ip: '1.2.3.4', phone: '+79991234567', locationId: 'loc-1' }

  it('skips all checks when enabled = false', async () => {
    const { svc, prisma } = makeService()
    await svc.assertSubmitAllowed({ ...base, enabled: false })
    expect(prisma.publicRequestLog.count).not.toHaveBeenCalled()
  })

  it('throws 429 when burst limit is reached', async () => {
    const { svc } = makeService({ publicRequestLog: { count: jest.fn().mockResolvedValue(5) } })
    await expect(svc.assertSubmitAllowed({ ...base, enabled: true })).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    })
  })

  it('throws 429 when phone cooldown is active', async () => {
    // burst = 0 (OK), phoneCooldown = 1 (blocked)
    const { svc } = makeService({
      publicRequestLog: { count: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1) },
    })
    await expect(svc.assertSubmitAllowed({ ...base, enabled: true })).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    })
  })

  it('skips phone cooldown check when phone is null', async () => {
    const { svc, prisma } = makeService()
    await svc.assertSubmitAllowed({ ...base, phone: null, enabled: true })
    // Only burst check (1 call), no phone cooldown check
    expect(prisma.publicRequestLog.count).toHaveBeenCalledTimes(1)
  })

  it('passes when burst and cooldown are both within limits', async () => {
    const { svc } = makeService({
      publicRequestLog: { count: jest.fn().mockResolvedValue(0) },
    })
    await expect(svc.assertSubmitAllowed({ ...base, enabled: true })).resolves.toBeUndefined()
  })

  it('queries burst count with hashed token and ip, not raw values', async () => {
    const { svc, prisma } = makeService()
    await svc.assertSubmitAllowed({ ...base, enabled: true })

    const burstCall = prisma.publicRequestLog.count.mock.calls[0][0]
    expect(burstCall.where.tokenHash).toBe(sha256(base.token))
    expect(burstCall.where.ipHash).toBe(sha256(base.ip))
    expect(burstCall.where.tokenHash).not.toBe(base.token)
  })
})

// ── logSubmit ─────────────────────────────────────────────────────────────────

describe('PublicRequestSecurityService.logSubmit', () => {
  it('creates log entry with hashed token, ip and phone', async () => {
    const { svc, prisma } = makeService()
    await svc.logSubmit({ companyId: 'co-1', token: 'tok', ip: '1.2.3.4', phone: '+7999', locationId: 'loc-1', channel: 'web' })

    expect(prisma.publicRequestLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tokenHash: sha256('tok'),
          ipHash: sha256('1.2.3.4'),
          phoneHash: sha256('+7999'),
          action: 'submit',
        }),
      }),
    )
  })

  it('stores null phoneHash when phone is null', async () => {
    const { svc, prisma } = makeService()
    await svc.logSubmit({ companyId: 'co-1', token: 'tok', ip: null, phone: null, locationId: 'loc-1', channel: 'web' })

    const data = prisma.publicRequestLog.create.mock.calls[0][0].data
    expect(data.phoneHash).toBeNull()
    expect(data.ipHash).toBeNull()
  })
})
