import { readFileSync } from 'fs';
import { join } from 'path';

import { TicketStatus } from '@prisma/client';

import { buildEquipmentHistory, personLabel, resolveResult } from './equipment-history.model';

/**
 * SMA-EQUIPMENT-HISTORY-PARTS-110B.
 *
 * Чистая сборка истории плюс охранные проверки схемы и миграции: граница
 * со складом должна держаться не на словах, а на отсутствии полей.
 */

function row(status: TicketStatus, comment: string | null, minutes: number) {
  return {
    toStatus: status,
    comment,
    createdAt: new Date(Date.UTC(2026, 8, 4, 8, minutes)),
    changedBy: null,
  };
}

describe('Сборка истории', () => {
  it('заявки идут от новых к старым', () => {
    const base = {
      status: TicketStatus.DONE, problemText: 'x', statusHistory: [], attachments: [],
      closedAt: null, problemCategory: null, assignedTechnician: null,
    };
    const out = buildEquipmentHistory([
      { ...base, id: 'a', ticketNumber: 1, createdAt: new Date('2026-01-01') },
      { ...base, id: 'b', ticketNumber: 2, createdAt: new Date('2026-05-01') },
    ] as any);
    expect(out.map((e) => e.ticketNumber)).toEqual([2, 1]);
  });

  it('результат — первый непустой комментарий завершения', () => {
    expect(
      resolveResult([
        row(TicketStatus.AWAITING_ACCEPTANCE, '   ', 10),
        row(TicketStatus.DONE, 'Промыл дренаж', 20),
      ]).text,
    ).toBe('Промыл дренаж');
  });

  it('передача на приёмку важнее закрытия: берётся более ранняя', () => {
    expect(
      resolveResult([
        row(TicketStatus.DONE, 'Принято клиентом', 30),
        row(TicketStatus.AWAITING_ACCEPTANCE, 'Заменил датчик', 10),
      ]).text,
    ).toBe('Заменил датчик');
  });

  it('без переходов завершения результата нет', () => {
    expect(resolveResult([]).text).toBeNull();
    expect(resolveResult([]).at).toBeNull();
  });

  it('исполнитель: фамилия и имя, иначе почта', () => {
    expect(personLabel({ id: 'u', firstName: 'Иван', lastName: 'Иванов', email: 'a@b.c' })).toBe('Иванов Иван');
    expect(personLabel({ id: 'u', firstName: null, lastName: null, email: 'a@b.c' })).toBe('a@b.c');
    expect(personLabel(null)).toBeNull();
  });

  it('неназначенная заявка не ломает сборку', () => {
    const out = buildEquipmentHistory([
      {
        id: 'a', ticketNumber: 7, createdAt: new Date('2026-01-01'), closedAt: null,
        status: TicketStatus.NEW, problemText: 'Течёт', problemCategory: null,
        assignedTechnician: null, statusHistory: [], attachments: [],
      },
    ] as any);
    expect(out[0].performedBy).toBeNull();
    expect(out[0].category).toBeNull();
    expect(out[0].partsInstalled).toEqual([]);
  });
});

describe('Схема Parts V1', () => {
  const schema = readFileSync(join(__dirname, '..', '..', 'prisma', 'schema.prisma'), 'utf8');
  const model = (name: string) => {
    const m = schema.match(new RegExp(`^model ${name} \\{[\\s\\S]*?^\\}`, 'm'));
    if (!m) throw new Error(`model ${name} not found`);
    return m[0];
  };

  it('ГРАНИЦА СКЛАДА: в PartDefinition нет остатков, цен и резервов', () => {
    const def = model('PartDefinition');
    for (const forbidden of ['stock', 'Stock', 'price', 'Price', 'cost', 'reserved', 'writeOff', 'inventoryCount']) {
      expect(def).not.toMatch(new RegExp(`\\b${forbidden}`));
    }
  });

  it('ГРАНИЦА СКЛАДА: в InstalledPart нет цен и складских движений', () => {
    const part = model('InstalledPart');
    for (const forbidden of ['price', 'Price', 'cost', 'reserved', 'writeOff', 'stockId']) {
      expect(part).not.toMatch(new RegExp(`\\b${forbidden}`));
    }
  });

  it('InstalledPart не хранит status: состояние определяет removedAt', () => {
    const part = model('InstalledPart');
    expect(part).toMatch(/removedAt\s+DateTime\?/);
    expect(part).not.toMatch(/^\s{2}status\s/m);
  });

  it('замена прослеживается: обе заявки и оба исполнителя', () => {
    const part = model('InstalledPart');
    for (const field of ['installedTicketId', 'removedTicketId', 'installedByUserId', 'removedByUserId']) {
      expect(part).toMatch(new RegExp(field));
    }
  });

  it('деталь принадлежит клиентскому контуру и единице', () => {
    const part = model('InstalledPart');
    expect(part).toMatch(/companyId\s+String/);
    expect(part).toMatch(/equipment\s+Equipment\s+@relation[\s\S]*?onDelete: Cascade/);
  });

  it('вывод позиции из каталога не рушит историю', () => {
    expect(model('InstalledPart')).toMatch(/partDefinition\s+PartDefinition\?[\s\S]*?onDelete: SetNull/);
  });

  it('связи Ticket и Equipment с историей заявок не дублируются', () => {
    // Своей таблицы жизненного цикла быть не должно.
    expect(schema).not.toMatch(/^model EquipmentTicketHistory/m);
    expect(schema).not.toMatch(/^model EquipmentServiceRecord/m);
    expect(model('Equipment')).toMatch(/tickets\s+Ticket\[\]/);
  });
});

describe('Миграция 202609100001', () => {
  const sql = readFileSync(
    join(__dirname, '..', '..', 'prisma', 'migrations', '202609100001_equipment_parts_v1', 'migration.sql'),
    'utf8',
  );

  it('только добавляет: ни DROP, ни ALTER существующих таблиц', () => {
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(sql).not.toMatch(/ALTER TABLE "(Equipment|Ticket|Company|User)"/);
  });

  it('таблицы и индексы переживают повторный прогон', () => {
    for (const line of sql.split('\n')) {
      if (/^\s*(CREATE TABLE|CREATE INDEX|CREATE UNIQUE INDEX)/i.test(line)) {
        expect(line).toMatch(/IF NOT EXISTS/i);
      }
    }
  });

  it('внешние ключи под проверкой существования', () => {
    const guarded = sql.match(/IF NOT EXISTS \(SELECT 1 FROM pg_constraint WHERE conname = '[^']+'\)/g) ?? [];
    const added = sql.match(/ADD CONSTRAINT "[^"]+"\s*\n?\s*FOREIGN KEY/g) ?? [];
    expect(added.length).toBe(8);
    expect(guarded.length).toBe(added.length);
  });
});
