import { BadRequestException } from '@nestjs/common'

import { assertProviderContractAllowsProblemCategory } from './ticket-access.utils'

/**
 * SMA-TICKET-CATEGORY-CONTRACT-VALIDATION-107A.
 *
 * Проверяется инвариант: провайдер не заводит заявку в контуре клиента по
 * категории, специализация которой не покрыта действующим договором. Раньше
 * такая заявка создавалась и тут же переставала быть видимой создателю —
 * канонический доступ отвечал 404 (воспроизведено на Stage в приёмке 103,
 * заявки #778/#779).
 *
 * Проверка сужает СОЗДАНИЕ. Правила чтения не трогаются, поэтому отдельно
 * зафиксировано, что уже существующая заявка вне охвата так и остаётся
 * невидимой — расширять доступ эта задача не должна.
 */

const PROVIDER = 'provider-1'
const CLIENT = 'client-1'
const IN_CONTRACT_SPEC = 'spec-in-contract'
const OUT_OF_CONTRACT_SPEC = 'spec-out-of-contract'

const CATEGORY_IN_CONTRACT = {
  specializationLinks: [
    { specializationId: IN_CONTRACT_SPEC, specialization: { name: 'Сантехника' } },
  ],
}
const CATEGORY_OUT_OF_CONTRACT = {
  specializationLinks: [
    { specializationId: OUT_OF_CONTRACT_SPEC, specialization: { name: 'Кровля' } },
  ],
}
/** Категория без привязанных специализаций договором не ограничивается. */
const CATEGORY_WITHOUT_SPECS = { specializationLinks: [] }

function makePrisma(options: {
  contract?: { id: string } | null
  contractSpecializationIds?: string[]
} = {}) {
  const contract = 'contract' in options ? options.contract : { id: 'contract-1' }
  const specIds = options.contractSpecializationIds ?? [IN_CONTRACT_SPEC]
  return {
    serviceContract: {
      findFirst: jest.fn().mockResolvedValue(contract),
    },
    serviceContractSpecialization: {
      findMany: jest.fn().mockResolvedValue(
        specIds.map((specializationId) => ({
          specializationId,
          specialization: { name: specializationId },
        })),
      ),
    },
  } as any
}

describe('assertProviderContractAllowsProblemCategory', () => {
  beforeEach(() => jest.clearAllMocks())

  it('РАЗРЕШАЕТ категорию, специализация которой есть в договоре', async () => {
    const prisma = makePrisma()

    await expect(
      assertProviderContractAllowsProblemCategory({
        prisma,
        actorCompanyId: PROVIDER,
        ownerCompanyId: CLIENT,
        category: CATEGORY_IN_CONTRACT,
      }),
    ).resolves.toBeUndefined()
  })

  it('ОТКЛОНЯЕТ категорию вне специализаций договора', async () => {
    const prisma = makePrisma()

    await expect(
      assertProviderContractAllowsProblemCategory({
        prisma,
        actorCompanyId: PROVIDER,
        ownerCompanyId: CLIENT,
        category: CATEGORY_OUT_OF_CONTRACT,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('сообщение об отказе на русском и без внутренних идентификаторов', async () => {
    const prisma = makePrisma()

    await expect(
      assertProviderContractAllowsProblemCategory({
        prisma,
        actorCompanyId: PROVIDER,
        ownerCompanyId: CLIENT,
        category: CATEGORY_OUT_OF_CONTRACT,
      }),
    ).rejects.toThrow('Категория заявки недоступна по специализациям действующего договора.')

    const error = await assertProviderContractAllowsProblemCategory({
      prisma,
      actorCompanyId: PROVIDER,
      ownerCompanyId: CLIENT,
      category: CATEGORY_OUT_OF_CONTRACT,
    }).catch((e) => e as Error)

    // Ни id договора, ни id специализаций, ни id компаний наружу не уходят.
    for (const secret of [PROVIDER, CLIENT, OUT_OF_CONTRACT_SPEC, 'contract-1']) {
      expect(error.message).not.toContain(secret)
    }
  })

  it('ОТКЛОНЯЕТ, когда действующего договора нет', async () => {
    const prisma = makePrisma({ contract: null })

    await expect(
      assertProviderContractAllowsProblemCategory({
        prisma,
        actorCompanyId: PROVIDER,
        ownerCompanyId: CLIENT,
        category: CATEGORY_IN_CONTRACT,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('ОТКЛОНЯЕТ, когда в договоре не перечислено ни одной специализации', async () => {
    const prisma = makePrisma({ contractSpecializationIds: [] })

    await expect(
      assertProviderContractAllowsProblemCategory({
        prisma,
        actorCompanyId: PROVIDER,
        ownerCompanyId: CLIENT,
        category: CATEGORY_IN_CONTRACT,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('пропускает категорию без привязанных специализаций', async () => {
    const prisma = makePrisma()

    await expect(
      assertProviderContractAllowsProblemCategory({
        prisma,
        actorCompanyId: PROVIDER,
        ownerCompanyId: CLIENT,
        category: CATEGORY_WITHOUT_SPECS,
      }),
    ).resolves.toBeUndefined()
  })

  it('СВОЙ контур не затрагивается: договор не запрашивается вовсе', async () => {
    const prisma = makePrisma({ contract: null })

    await expect(
      assertProviderContractAllowsProblemCategory({
        prisma,
        actorCompanyId: CLIENT,
        ownerCompanyId: CLIENT,
        category: CATEGORY_OUT_OF_CONTRACT,
      }),
    ).resolves.toBeUndefined()
    expect(prisma.serviceContract.findFirst).not.toHaveBeenCalled()
  })

  it('пустые идентификаторы не приводят к запросу договора и не роняют создание', async () => {
    const prisma = makePrisma()

    await expect(
      assertProviderContractAllowsProblemCategory({
        prisma,
        actorCompanyId: '',
        ownerCompanyId: CLIENT,
        category: CATEGORY_OUT_OF_CONTRACT,
      }),
    ).resolves.toBeUndefined()
    expect(prisma.serviceContract.findFirst).not.toHaveBeenCalled()
  })

  it('роль актора на проверку не влияет: ограничивает договор, а не специализации пользователя', async () => {
    // Ровно та дыра, из-за которой заводился нечитаемый тикет: у management-ролей
    // собственных специализаций нет, и прежняя проверка их не ограничивала.
    const prisma = makePrisma()

    await expect(
      assertProviderContractAllowsProblemCategory({
        prisma,
        actorCompanyId: PROVIDER,
        ownerCompanyId: CLIENT,
        category: CATEGORY_OUT_OF_CONTRACT,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.serviceContract.findFirst).toHaveBeenCalled()
  })

  it('договор выбирается по паре провайдер→клиент и по действующему окну', async () => {
    const prisma = makePrisma()

    await assertProviderContractAllowsProblemCategory({
      prisma,
      actorCompanyId: PROVIDER,
      ownerCompanyId: CLIENT,
      category: CATEGORY_IN_CONTRACT,
    })

    const where = prisma.serviceContract.findFirst.mock.calls[0][0].where
    expect(where.providerCompanyId).toBe(PROVIDER)
    expect(where.clientCompanyId).toBe(CLIENT)
    // Роль договора здесь не фиксируется: PRIMARY и SECONDARY проходят один
    // и тот же резолвер, что и на чтении, — согласованность по построению.
    expect(where.role).toBeUndefined()
  })
})
