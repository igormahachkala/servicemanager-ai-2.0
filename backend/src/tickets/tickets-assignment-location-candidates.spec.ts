import { TicketsAssignmentService } from './tickets.assignment.service';

/**
 * SMA-ROUND-TECHNICIAN-ASSIGNMENT-025.
 *
 * Планирование обходов берёт кандидатов методом listLocationAssignableExecutors.
 * Его ценность ровно в том, что он складывает два уже существующих шага
 * назначения и ничего не решает сам. Набор держит эту композицию: если сужение
 * по договору и привязкам к точке выпадет, планирование начнёт предлагать
 * исполнителей, которым эта точка недоступна, — то есть вернётся ровно тот
 * дефект, ради которого слайс делался.
 *
 * Прототип вызывается напрямую: проверяется порядок вызовов, а не работа
 * резолвера — у его шагов есть свои наборы.
 */
describe('025 кандидаты на исполнение в точке', () => {
  const ALL = [{ id: 't-1' }, { id: 't-2' }];
  const IN_SCOPE = [{ id: 't-1' }];

  function makeSpy() {
    const svc: any = Object.create(TicketsAssignmentService.prototype);
    svc.listAllTechnicians = jest.fn(async () => ALL);
    svc.filterTechniciansByLocationBindings = jest.fn(async () => IN_SCOPE);
    return svc;
  }

  it('1. сужает по договору и привязкам к точке, а не отдаёт всех', async () => {
    const svc = makeSpy();

    const result = await TicketsAssignmentService.prototype.listLocationAssignableExecutors.call(svc, {
      employerCompanyId: 'provider-1',
      scopeCompanyId: 'client-a',
      locationId: 'loc-1',
    });

    expect(svc.filterTechniciansByLocationBindings).toHaveBeenCalledTimes(1);
    expect(svc.filterTechniciansByLocationBindings).toHaveBeenCalledWith(ALL, 'client-a', 'loc-1');
    expect(result).toBe(IN_SCOPE);
  });

  it('2. исполнителей берёт у компании работодателя', async () => {
    const svc = makeSpy();

    await TicketsAssignmentService.prototype.listLocationAssignableExecutors.call(svc, {
      employerCompanyId: 'provider-1',
      scopeCompanyId: 'client-a',
      locationId: 'loc-1',
    });

    expect(svc.listAllTechnicians).toHaveBeenCalledTimes(1);
    const [companyId] = svc.listAllTechnicians.mock.calls[0];
    expect(companyId).toBe('provider-1');
  });

  it('3. специализации не сужают: у обхода нет категории проблемы', async () => {
    const svc = makeSpy();

    await TicketsAssignmentService.prototype.listLocationAssignableExecutors.call(svc, {
      employerCompanyId: 'provider-1',
      scopeCompanyId: 'client-a',
      locationId: 'loc-1',
    });

    const [, requiredSpecializations, options] = svc.listAllTechnicians.mock.calls[0];
    expect(requiredSpecializations).toEqual([]);
    // Флаг делает отсутствие требований явным вместо тихого «никто не подошёл».
    expect(options).toEqual({ fallbackToAllWhenNoSpecializations: true });
  });
});
