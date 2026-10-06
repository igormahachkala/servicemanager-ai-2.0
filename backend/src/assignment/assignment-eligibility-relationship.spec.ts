import { AssignmentEligibilityResolver } from './assignment-eligibility.resolver';

/**
 * Relationship-слой AssignmentEligibilityResolver.
 *
 * Эти проверки закрывают разрыв, найденный независимым ревью: договорные
 * шлюзы в коде есть, но ни один тест их не охранял — обе отрицательные
 * мутации проходили полный набор (1630 тестов) зелёными.
 *
 * Поэтому здесь вызывается НАСТОЯЩИЙ filterTechniciansByLocationBindings,
 * а не заглушка: соседний tickets-assignment-location-candidates.spec
 * подменяет этот метод целиком и проверяет только проводку.
 *
 * Техник намеренно без привязок и без явного режима области: тогда его
 * собственная область — legacy tenant_wide, и ЕДИНСТВЕННОЕ, что может его
 * отсечь, — это договор. Если договорный шлюз убрать, техник станет
 * eligible, и тест покраснеет.
 */

type FakeRows = {
  users: Array<{ id: string; companyId: string }>;
  accessScopes?: Array<{ userId: string; companyId: string; locationMode: any }>;
  bindings?: Array<{ userId: string; companyId: string; locationId: string }>;
};

function makeResolver(rows: FakeRows, contractByProvider: Record<string, unknown>) {
  const prisma: any = {
    user: { findMany: jest.fn(async () => rows.users) },
    userAccessScope: { findMany: jest.fn(async () => rows.accessScopes ?? []) },
    userLocationBinding: { findMany: jest.fn(async () => rows.bindings ?? []) },
  };

  const serviceContracts: any = {
    getLinkedClientAccess: jest.fn(async (providerCompanyId: string) =>
      Object.prototype.hasOwnProperty.call(contractByProvider, providerCompanyId)
        ? contractByProvider[providerCompanyId]
        : null,
    ),
  };

  return {
    resolver: new AssignmentEligibilityResolver(prisma, serviceContracts),
    serviceContracts,
  };
}

describe('AssignmentEligibilityResolver: Relationship gates', () => {
  it('1. нет договора — исполнитель НЕ становится eligible (fail closed)', async () => {
    /*
     * Главное здесь: отсутствие договора не означает «все локации».
     * Прежняя мутация ставила для отсутствующего договора null вместо
     * пустого множества, то есть «ограничений нет», и полный набор
     * оставался зелёным.
     */
    const { resolver, serviceContracts } = makeResolver(
      { users: [{ id: 'tech-foreign', companyId: 'provider-1' }] },
      {}, // договора с client-1 нет вовсе
    );

    const result = await resolver.filterTechniciansByLocationBindings(
      [{ id: 'tech-foreign' }],
      'client-1',
      'location-1',
    );

    expect(result).toEqual([]);
    expect(serviceContracts.getLinkedClientAccess).toHaveBeenCalledWith('provider-1', 'client-1');
  });

  it('1a. проверка не вакуумная: свой же tenant без договора остаётся eligible', async () => {
    /*
     * Контроль к предыдущему: если бы тест отсекал всех подряд, он был бы
     * бесполезен. Сотрудник самой клиентской компании договора не требует —
     * employerCompanyId === scopeCompanyId, — и обязан пройти.
     */
    const { resolver, serviceContracts } = makeResolver(
      { users: [{ id: 'tech-own', companyId: 'client-1' }] },
      {},
    );

    const result = await resolver.filterTechniciansByLocationBindings(
      [{ id: 'tech-own' }],
      'client-1',
      'location-1',
    );

    expect(result).toEqual([{ id: 'tech-own' }]);
    // Для своего tenant договор не запрашивается вовсе.
    expect(serviceContracts.getLinkedClientAccess).not.toHaveBeenCalled();
  });

  it('2. чужой работодатель: договор решает, какие локации доступны', async () => {
    /*
     * Договор есть, но его область — только location-allowed. Техник со
     * своей tenant_wide областью всё равно НЕ попадает на location-forbidden:
     * собственная область исполнителя не расширяет Relationship.
     *
     * Если убрать шлюз employerCompanyId !== scopeCompanyId, договор не
     * проверяется вовсе и техник проходит на любую локацию — тест покраснеет.
     */
    const contract = {
      role: 'SECONDARY',
      effectiveLocationScope: { mode: 'bound_locations' as const, locationIds: ['location-allowed'] },
    };

    const forbidden = makeResolver(
      { users: [{ id: 'tech-foreign', companyId: 'provider-1' }] },
      { 'provider-1': contract },
    );
    await expect(
      forbidden.resolver.filterTechniciansByLocationBindings(
        [{ id: 'tech-foreign' }],
        'client-1',
        'location-forbidden',
      ),
    ).resolves.toEqual([]);

    const allowed = makeResolver(
      { users: [{ id: 'tech-foreign', companyId: 'provider-1' }] },
      { 'provider-1': contract },
    );
    await expect(
      allowed.resolver.filterTechniciansByLocationBindings(
        [{ id: 'tech-foreign' }],
        'client-1',
        'location-allowed',
      ),
    ).resolves.toEqual([{ id: 'tech-foreign' }]);
  });

  it('2a. договор на все локации не отменяет собственную область исполнителя', async () => {
    /*
     * Обратная сторона: tenant_wide договор снимает договорное ограничение,
     * но область самого исполнителя продолжает действовать. SELECTED_LOCATIONS
     * с привязкой только к location-allowed не пускает на другую локацию —
     * ALL_LOCATIONS в договоре не расширяет её.
     */
    const contract = {
      role: 'PRIMARY',
      effectiveLocationScope: { mode: 'tenant_wide' as const, locationIds: [] as string[] },
    };

    const { resolver } = makeResolver(
      {
        users: [{ id: 'tech-bound', companyId: 'provider-1' }],
        accessScopes: [
          { userId: 'tech-bound', companyId: 'provider-1', locationMode: 'SELECTED_LOCATIONS' },
        ],
        bindings: [
          { userId: 'tech-bound', companyId: 'provider-1', locationId: 'location-allowed' },
        ],
      },
      { 'provider-1': contract },
    );

    await expect(
      resolver.filterTechniciansByLocationBindings([{ id: 'tech-bound' }], 'client-1', 'location-other'),
    ).resolves.toEqual([]);
  });

  it('3. удалённый или отключённый исполнитель отсекается до договора', async () => {
    /*
     * prisma.user.findMany фильтрует по isActive/deletedAt, поэтому строки
     * для такого пользователя просто нет — и он не eligible независимо от
     * договора.
     */
    const { resolver } = makeResolver({ users: [] }, { 'provider-1': { role: 'PRIMARY' } });

    await expect(
      resolver.filterTechniciansByLocationBindings([{ id: 'tech-gone' }], 'client-1', 'location-1'),
    ).resolves.toEqual([]);
  });
});
