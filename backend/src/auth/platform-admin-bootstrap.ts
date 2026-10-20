/**
 * SMA-SECURITY-P1 — решение о первоначальном создании PLATFORM_ADMIN.
 *
 * Чистый модуль: ни Prisma, ни Nest, ни process.env. Сюда вынесено ВСЁ
 * решение о том, можно ли создавать привилегированного пользователя, чтобы
 * его можно было проверить исполнением, а не чтением.
 *
 * Почему это отдельный модуль, а не ветвление внутри скрипта: раньше та же
 * логика жила в AuthService.login() и выполнялась на каждый неаутентифици-
 * рованный POST /auth/login. Теперь единственный путь — операторский запуск,
 * и правила этого пути должны быть видимы и проверяемы отдельно от обвязки
 * с базой.
 *
 * Модуль НИКОГДА не возвращает «создать» для уже существующего пользователя:
 * ни повышения роли, ни смены пароля у действующего аккаунта здесь нет и
 * быть не может.
 */

/**
 * Явное подтверждение оператора.
 *
 * Значение совпадает с именем операции, а не с «yes»: случайно набрать его
 * в чужой консоли нельзя, а в истории команд оно читается однозначно.
 * Тот же приём уже применён в канонических скриптах Stage.
 */
export const BOOTSTRAP_CONFIRM_ENV = 'PLATFORM_ADMIN_BOOTSTRAP_CONFIRM'
export const BOOTSTRAP_CONFIRM_VALUE = 'create-platform-admin'

/**
 * Ключ консультативной блокировки PostgreSQL для bootstrap.
 *
 * Зачем нужна. Company.name уникальности в схеме НЕ имеет, поэтому два
 * одновременных запуска оба видели отсутствие платформенной компании и оба её
 * создавали — получались дубликаты организаций. User.email уникален, так что
 * второй запуск падал уже на пользователе, но лишняя компания оставалась.
 *
 * Блокировка берётся через pg_advisory_xact_lock в начале транзакции и
 * снимается самой транзакцией — ни при ошибке, ни при падении процесса она не
 * «залипает». Схему при этом менять не требуется: миграции здесь запрещены, а
 * добавление @unique на Company.name затронуло бы существующие данные.
 *
 * Значение произвольное, но фиксированное, и принадлежит только этой
 * операции: 0x534D4150 — ASCII «SMAP», SMA Platform admin.
 */
export const BOOTSTRAP_ADVISORY_LOCK_KEY = 0x534d4150

/** Роль, которую вправе получить только bootstrap. */
export type ExistingUserRole = string

export type BootstrapInput = {
  email: string
  password: string
  /** Значение переменной подтверждения, как её отдал оператор. */
  confirm: string | undefined
  /** Что уже лежит в базе под этим email. null — ничего. */
  existingUser: { id: string; role: ExistingUserRole } | null
}

export type BootstrapDecision =
  /** Создавать нельзя; причина годится для вывода оператору. */
  | { action: 'refuse'; reason: string }
  /** Создавать нечего: аккаунт уже есть и он уже PLATFORM_ADMIN. */
  | { action: 'noop'; reason: string }
  /** Можно создавать. */
  | { action: 'create' }

const PLATFORM_ADMIN_ROLE = 'PLATFORM_ADMIN'

/**
 * Можно ли выполнить bootstrap.
 *
 * Порядок проверок — от самых дешёвых и самых строгих к остальным, и каждая
 * из них закреплена тестом:
 *
 * 1. Нет подтверждения оператора — отказ. Это и есть граница «явного
 *    запуска»: конфигурации окружения недостаточно, нужно отдельное
 *    осознанное действие. Проверяется ПЕРВОЙ, чтобы случайный запуск с
 *    настроенным окружением ничего не делал.
 * 2. Нет email или пароля — отказ. Половина конфигурации не создаёт
 *    привилегированный аккаунт с пустым паролем.
 * 3. Email занят пользователем с другой ролью — отказ. Bootstrap не
 *    повышает права существующему аккаунту: это был бы путь эскалации.
 * 4. Email занят действующим PLATFORM_ADMIN — ничего не делаем. Повторный
 *    запуск безопасен и не создаёт дубликатов; пароль действующего аккаунта
 *    не трогается.
 * 5. Иначе — создавать.
 */
export function decidePlatformAdminBootstrap(input: BootstrapInput): BootstrapDecision {
  if (input.confirm !== BOOTSTRAP_CONFIRM_VALUE) {
    return {
      action: 'refuse',
      reason: `bootstrap requires ${BOOTSTRAP_CONFIRM_ENV}=${BOOTSTRAP_CONFIRM_VALUE}`,
    }
  }

  const email = input.email.trim().toLowerCase()
  const password = input.password.trim()

  if (!email || !password) {
    return {
      action: 'refuse',
      reason: 'PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD must both be set',
    }
  }

  if (input.existingUser) {
    if (input.existingUser.role !== PLATFORM_ADMIN_ROLE) {
      return {
        action: 'refuse',
        reason: `refusing to change existing account: ${email} already exists with another role`,
      }
    }
    return { action: 'noop', reason: `already exists as PLATFORM_ADMIN: ${email}` }
  }

  return { action: 'create' }
}

/**
 * Минимальный интерфейс транзакции для bootstrap.
 *
 * Специально узкий и без Prisma: создание со всеми его инвариантами —
 * порядок блокировки, перепроверка решения, однократное создание компании —
 * проверяется исполнением на подставном объекте. Скрипт лишь связывает этот
 * интерфейс с настоящей транзакцией Prisma.
 */
export type BootstrapTx = {
  /** Взять консультативную блокировку. Должно быть ПЕРВЫМ действием. */
  lockAdvisory(key: number): Promise<void>
  findUserByEmail(email: string): Promise<{ id: string; role: ExistingUserRole } | null>
  findCompanyByName(name: string): Promise<{ id: string } | null>
  createCompany(name: string): Promise<{ id: string }>
  createUser(input: { companyId: string; email: string }): Promise<void>
}

export type BootstrapApplied =
  | { action: 'refuse'; reason: string }
  | { action: 'noop'; reason: string }
  | { action: 'created'; createdCompany: boolean }

/**
 * Выполнить создание под блокировкой.
 *
 * Порядок важен и закреплён тестами:
 *
 * 1. Сначала блокировка. Иначе два запуска одновременно прочитали бы
 *    отсутствие компании и оба её создали — уникальности у Company.name нет.
 * 2. Затем ПЕРЕПРОВЕРКА решения той же чистой функцией. Пока ждали
 *    блокировку, конкурент мог создать администратора; создавать второго
 *    нельзя, и повышать права существующему тоже нельзя.
 * 3. Компания создаётся только если её действительно нет, и ровно один раз.
 */
export async function applyPlatformAdminBootstrap(
  tx: BootstrapTx,
  params: { email: string; password: string; confirm: string | undefined; companyName: string },
): Promise<BootstrapApplied> {
  await tx.lockAdvisory(BOOTSTRAP_ADVISORY_LOCK_KEY)

  const freshUser = await tx.findUserByEmail(params.email)
  const recheck = decidePlatformAdminBootstrap({
    email: params.email,
    password: params.password,
    confirm: params.confirm,
    existingUser: freshUser,
  })

  if (recheck.action === 'refuse') return recheck
  if (recheck.action === 'noop') return recheck

  const existingCompany = await tx.findCompanyByName(params.companyName)
  const company = existingCompany ?? (await tx.createCompany(params.companyName))

  await tx.createUser({ companyId: company.id, email: params.email })

  return { action: 'created', createdCompany: !existingCompany }
}

/**
 * Безопасное описание ошибки для вывода оператору.
 *
 * Ошибки Prisma включают в текст аргументы вызова — а в них у нас попадает
 * поле password с хешем. Поэтому наружу отдаётся только класс ошибки и, если
 * есть, её код: ни аргументов, ни стека, ни хеша.
 */
export function describeBootstrapFailure(error: unknown): string {
  if (error && typeof error === 'object') {
    const code = (error as { code?: unknown }).code
    const name = (error as { name?: unknown }).name
    const parts = [
      typeof name === 'string' && name ? name : 'Error',
      typeof code === 'string' && code ? `code=${code}` : null,
    ].filter(Boolean)
    return parts.join(' ')
  }
  return 'Error'
}
