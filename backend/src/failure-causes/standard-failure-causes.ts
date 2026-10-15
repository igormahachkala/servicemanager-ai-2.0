import { CompanyType } from '@prisma/client'

/**
 * Стандартный шаблон справочника причин отказа для CLIENT-компании.
 *
 * Mobile/MAX требуют выбранную Failure Cause перед submitAcceptance. У новой
 * CLIENT-компании справочник пуст — техник физически не может отправить работу
 * на приёмку. Этот шаблон — ТОЛЬКО начальное наполнение: после создания это
 * обычные company-owned записи, которыми управляет штатный management-flow.
 * Не глобальный shared-словарь, не runtime fallback, не второй справочник.
 */
export const STANDARD_FAILURE_CAUSE_NAMES = [
  'Естественный износ',
  'Загрязнение / засор',
  'Механическое повреждение',
  'Неисправность электрики / электропитания',
  'Перегрев / нарушение охлаждения',
  'Утечка / разгерметизация',
  'Ослабление контакта / крепления / соединения',
  'Неправильная эксплуатация',
  'Нарушение настройки / регулировки',
  'Неисправность узла / компонента',
  'Внешнее воздействие',
  'Причина не установлена',
] as const

/**
 * Минимальный контракт Prisma для bootstrap — совместим и с Nest PrismaService,
 * и с голым PrismaClient из backfill-скрипта (без Nest DI / без циклов модулей).
 */
export interface FailureCauseBootstrapPrisma {
  company: {
    findUnique(args: {
      where: { id: string }
      select: { id: true; type: true }
    }): Promise<{ id: string; type: CompanyType } | null>
  }
  failureCause: {
    count(args: { where: { companyId: string } }): Promise<number>
    createMany(args: {
      data: { companyId: string; name: string }[]
      skipDuplicates?: boolean
    }): Promise<{ count: number }>
  }
}

export type EnsureDefaultsSkip = 'already-has-causes' | 'not-client' | 'company-missing'

export interface EnsureDefaultsResult {
  companyId: string
  created: number
  skipped: EnsureDefaultsSkip | null
}

/**
 * Идемпотентно создаёт стандартные причины ТОЛЬКО если у CLIENT-компании их
 * сейчас нет ни одной. Семантика «seed-only-if-empty» намеренна:
 *
 *  - пустая компания → 12 записей (чинит блокировку приёмки);
 *  - повторный вызов (есть ≥1 запись) → no-op → без дублей;
 *  - причину, которую администратор отредактировал / деактивировал / удалил,
 *    bootstrap НЕ восстанавливает (у компании уже есть записи → skip);
 *  - кастомные причины не затрагиваются.
 *
 * Запись владеет конкретная CLIENT-компания (companyId). PROVIDER и
 * несуществующая компания пропускаются без побочных эффектов. Функция НЕ
 * вызывается на startup/в каждом запросе — только при создании CLIENT-компании
 * и из контролируемого backfill-скрипта, поэтому «тихого» restore не бывает.
 */
export async function ensureDefaultFailureCauses(
  prisma: FailureCauseBootstrapPrisma,
  companyId: string,
): Promise<EnsureDefaultsResult> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, type: true },
  })
  if (!company) {
    return { companyId, created: 0, skipped: 'company-missing' }
  }
  if (company.type !== CompanyType.CLIENT) {
    return { companyId, created: 0, skipped: 'not-client' }
  }

  const existing = await prisma.failureCause.count({ where: { companyId } })
  if (existing > 0) {
    return { companyId, created: 0, skipped: 'already-has-causes' }
  }

  // skipDuplicates + @@unique([companyId, name]) — защита от гонки при
  // одновременном создании компании (оба увидят count 0, дубли не появятся).
  const result = await prisma.failureCause.createMany({
    data: STANDARD_FAILURE_CAUSE_NAMES.map((name) => ({ companyId, name })),
    skipDuplicates: true,
  })
  return { companyId, created: result.count, skipped: null }
}
