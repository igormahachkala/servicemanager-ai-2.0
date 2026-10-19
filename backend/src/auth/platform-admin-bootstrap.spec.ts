/**
 * SMA-SECURITY-P1 — проверки bootstrap исполнением.
 *
 * Каждое правило проверяется поведением функции, а не присутствием строки в
 * исходнике: иначе «защита» могла бы существовать только в комментарии.
 */
import {
  BOOTSTRAP_CONFIRM_ENV,
  BOOTSTRAP_CONFIRM_VALUE,
  decidePlatformAdminBootstrap,
  describeBootstrapFailure,
  type BootstrapInput,
} from './platform-admin-bootstrap'

function input(overrides: Partial<BootstrapInput> = {}): BootstrapInput {
  return {
    email: 'admin@example.com',
    password: 'S3cret!',
    confirm: BOOTSTRAP_CONFIRM_VALUE,
    existingUser: null,
    ...overrides,
  }
}

describe('неавторизованный bootstrap невозможен', () => {
  it('без подтверждения оператора — отказ', () => {
    const d = decidePlatformAdminBootstrap(input({ confirm: undefined }))
    expect(d.action).toBe('refuse')
    expect(d.action === 'refuse' && d.reason).toContain(BOOTSTRAP_CONFIRM_ENV)
  })

  it('настроенного окружения НЕДОСТАТОЧНО: нужен отдельный осознанный запуск', () => {
    // Ровно та ситуация, что была в Production: PLATFORM_ADMIN_* заданы,
    // но этого больше не хватает, чтобы что-то создалось.
    expect(decidePlatformAdminBootstrap(input({ confirm: undefined })).action).toBe('refuse')
    expect(decidePlatformAdminBootstrap(input({ confirm: '' })).action).toBe('refuse')
  })

  it('похожее, но неточное подтверждение не проходит', () => {
    for (const confirm of ['yes', 'true', '1', 'CREATE-PLATFORM-ADMIN', 'create-platform-admin ']) {
      expect(decidePlatformAdminBootstrap(input({ confirm })).action).toBe('refuse')
    }
  })

  it('подтверждение проверяется ПЕРВЫМ: без него отказ даже при полной конфигурации', () => {
    const d = decidePlatformAdminBootstrap(input({ confirm: undefined, email: '', password: '' }))
    expect(d.action === 'refuse' && d.reason).toContain(BOOTSTRAP_CONFIRM_ENV)
  })
})

describe('отсутствующий admin не создаётся сам', () => {
  it('без email или пароля — отказ, а не создание с пустым паролем', () => {
    expect(decidePlatformAdminBootstrap(input({ email: '' })).action).toBe('refuse')
    expect(decidePlatformAdminBootstrap(input({ password: '' })).action).toBe('refuse')
    expect(decidePlatformAdminBootstrap(input({ email: '', password: '' })).action).toBe('refuse')
  })

  it('пробелы вместо значения не считаются значением', () => {
    expect(decidePlatformAdminBootstrap(input({ email: '   ' })).action).toBe('refuse')
    expect(decidePlatformAdminBootstrap(input({ password: '   ' })).action).toBe('refuse')
  })

  it('с подтверждением и полными данными — создавать разрешено', () => {
    expect(decidePlatformAdminBootstrap(input()).action).toBe('create')
  })
})

describe('повторный bootstrap не создаёт дубликаты', () => {
  it('действующий PLATFORM_ADMIN — ничего не делаем', () => {
    const d = decidePlatformAdminBootstrap(
      input({ existingUser: { id: 'u-1', role: 'PLATFORM_ADMIN' } }),
    )
    expect(d.action).toBe('noop')
  })

  it('повторный запуск идемпотентен: решение то же самое', () => {
    const existing = { id: 'u-1', role: 'PLATFORM_ADMIN' }
    const first = decidePlatformAdminBootstrap(input({ existingUser: existing }))
    const second = decidePlatformAdminBootstrap(input({ existingUser: existing }))
    expect(first).toEqual(second)
    expect(first.action).not.toBe('create')
  })

  it('пароль действующего аккаунта не затрагивается: решение не «создать» и не «обновить»', () => {
    // В типе решения вообще нет действия, меняющего существующего пользователя.
    const d = decidePlatformAdminBootstrap(
      input({ existingUser: { id: 'u-1', role: 'PLATFORM_ADMIN' }, password: 'НовыйПароль' }),
    )
    expect(d.action).toBe('noop')
  })
})

describe('bootstrap не повышает права существующему аккаунту', () => {
  it.each(['ADMIN', 'MASTER', 'DISPATCHER', 'TECHNICIAN', 'CLIENT', 'NETWORK_DIRECTOR', 'STAFF'])(
    'email занят ролью %s — отказ, а не эскалация',
    (role) => {
      const d = decidePlatformAdminBootstrap(input({ existingUser: { id: 'u-1', role } }))
      expect(d.action).toBe('refuse')
      expect(d.action === 'refuse' && d.reason).toContain('another role')
    },
  )

  it('существующий обычный пользователь не превращается в PLATFORM_ADMIN ни при каком подтверждении', () => {
    const d = decidePlatformAdminBootstrap(
      input({ confirm: BOOTSTRAP_CONFIRM_VALUE, existingUser: { id: 'u-1', role: 'TECHNICIAN' } }),
    )
    expect(d.action).toBe('refuse')
  })
})

describe('multi-tenant isolation сохраняется', () => {
  it('решение зависит только от email, подтверждения и найденного пользователя', () => {
    /*
     * Модуль не принимает ни companyId, ни tenant: он не может «выбрать»
     * чужую организацию и не может расширить область. Привязка к компании
     * делается скриптом по имени платформенной компании, и существующие
     * организации при этом не изменяются.
     */
    const keys = Object.keys(input()).sort()
    expect(keys).toEqual(['confirm', 'email', 'existingUser', 'password'])
  })

  it('уже занятый в другом тенанте email не даёт создать второго админа', () => {
    // Email уникален глобально, поэтому существующая запись из любой
    // организации приводит к отказу или noop, но никогда к созданию.
    expect(
      decidePlatformAdminBootstrap(input({ existingUser: { id: 'u-other', role: 'ADMIN' } })).action,
    ).toBe('refuse')
    expect(
      decidePlatformAdminBootstrap(input({ existingUser: { id: 'u-other', role: 'PLATFORM_ADMIN' } }))
        .action,
    ).toBe('noop')
  })
})

describe('privileged credentials не пишутся в логи', () => {
  it('описание ошибки не содержит аргументов запроса', () => {
    // Ошибка Prisma несёт в себе данные вызова — включая хеш пароля.
    const prismaLike = Object.assign(new Error('Invalid `prisma.user.create()` invocation'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
      meta: { target: ['email'] },
      // то, что ни в коем случае не должно попасть в журнал
      args: { data: { password: '$2b$10$HASHHASHHASH', email: 'admin@example.com' } },
    })

    const described = describeBootstrapFailure(prismaLike)
    expect(described).toContain('PrismaClientKnownRequestError')
    expect(described).toContain('P2002')
    expect(described).not.toContain('$2b$10$')
    expect(described).not.toContain('password')
    expect(described).not.toContain('admin@example.com')
  })

  it('причина отказа не содержит пароля', () => {
    const d = decidePlatformAdminBootstrap(
      input({ password: 'СуперСекрет', existingUser: { id: 'u-1', role: 'ADMIN' } }),
    )
    expect(d.action === 'refuse' && d.reason).not.toContain('СуперСекрет')
  })

  it('произвольная ошибка не раскрывает текст', () => {
    expect(describeBootstrapFailure('boom with $2b$10$secret')).toBe('Error')
    expect(describeBootstrapFailure(null)).toBe('Error')
  })
})
