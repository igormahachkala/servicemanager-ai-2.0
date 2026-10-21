import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateTicketDto } from './create-ticket.dto';
import { UpdateTicketDto } from './update-ticket.dto';

/**
 * P2 TICKET DEADLINE — очистка срока выполнения.
 *
 * Контракт plannedDueAt — string | null. Очистка приходит как null или пустая
 * строка. @IsOptional пропускает только null/undefined, поэтому пустую строку
 * раньше отвергал @IsDateString (400), и клиент не мог сохранить заявку без
 * срока, очистив его пустым значением. Здесь закреплено, что null и '' проходят
 * как «срока нет», валидная дата проходит, а мусорная строка отвергается.
 */
async function plannedDueAtErrors(Dto: any, value: unknown): Promise<number> {
  const instance = plainToInstance(Dto, { plannedDueAt: value } as any);
  const errors = await validate(instance, { skipMissingProperties: true });
  return errors.filter((e) => e.property === 'plannedDueAt').length;
}

describe.each([
  ['CreateTicketDto', CreateTicketDto],
  ['UpdateTicketDto', UpdateTicketDto],
])('%s plannedDueAt — очистка срока', (_name, Dto) => {
  it('null — срок очищен, ошибок нет', async () => {
    expect(await plannedDueAtErrors(Dto, null)).toBe(0);
  });

  it("пустая строка — срок очищен, ошибок нет", async () => {
    expect(await plannedDueAtErrors(Dto, '')).toBe(0);
  });

  it('валидная ISO-дата — ошибок нет', async () => {
    expect(await plannedDueAtErrors(Dto, '2030-01-02T10:30:00.000Z')).toBe(0);
  });

  it('мусорная строка — отвергается', async () => {
    expect(await plannedDueAtErrors(Dto, 'not-a-date')).toBeGreaterThan(0);
  });
});
