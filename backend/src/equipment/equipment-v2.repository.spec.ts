import { readFileSync } from 'fs';
import { join } from 'path';

import { PrismaService } from '../prisma/prisma.service';
import { EquipmentRepository } from './equipment.repository';

/**
 * SMA-EQUIPMENT-V2-110A.
 *
 * Слой запросов: отбор обязан идти в базе и всегда внутри одного tenant.
 * Плюс охранные проверки схемы — V2 добавляет поля и снимки, но не имеет права
 * оборвать связи, на которых держатся заявки и обходы.
 */

const COMPANY = 'client-company';
const OTHER_COMPANY = 'another-company';

function makeRepo() {
  const findMany = jest.fn().mockResolvedValue([]);
  const findFirst = jest.fn().mockResolvedValue(null);
  const prisma = {
    equipment: { findMany, findFirst },
    location: { findFirst: jest.fn(), findUnique: jest.fn() },
  } as any;
  return { repo: new EquipmentRepository(prisma as PrismaService), findMany, findFirst };
}

describe('EquipmentRepository.findAllByCompany', () => {
  it('всегда ограничивает выборку компанией — чужой парк недостижим', () => {
    const { repo, findMany } = makeRepo();

    repo.findAllByCompany(COMPANY, { search: 'SN-1', locationId: 'loc-1', status: 'ACTIVE' });

    const where = findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe(COMPANY);
    expect(JSON.stringify(where)).not.toContain(OTHER_COMPANY);
  });

  it('поиск идёт по паспорту, а не только по названию', () => {
    const { repo, findMany } = makeRepo();

    repo.findAllByCompany(COMPANY, { search: 'GB162' });

    const fields = findMany.mock.calls[0][0].where.OR.map((clause: any) => Object.keys(clause)[0]);
    expect(fields.sort()).toEqual([
      'inventoryNumber',
      'manufacturer',
      'model',
      'name',
      'serialNumber',
    ]);
  });

  it('поиск регистронезависимый', () => {
    const { repo, findMany } = makeRepo();

    repo.findAllByCompany(COMPANY, { search: 'gb162' });

    for (const clause of findMany.mock.calls[0][0].where.OR) {
      expect(Object.values(clause)[0]).toMatchObject({ mode: 'insensitive' });
    }
  });

  it('пробелы вместо запроса поиском не считаются', () => {
    const { repo, findMany } = makeRepo();

    repo.findAllByCompany(COMPANY, { search: '   ' });

    expect(findMany.mock.calls[0][0].where.OR).toBeUndefined();
  });

  it('фильтр по площадке и область площадок действуют одновременно', () => {
    // Раньше второй спред затирал первый, и выбор точки в интерфейсе не влиял
    // ни на что у пользователя, привязанного к нескольким площадкам.
    const { repo, findMany } = makeRepo();

    repo.findAllByCompany(COMPANY, { locationIds: ['loc-1', 'loc-2'], locationId: 'loc-1' });

    expect(findMany.mock.calls[0][0].where.locationId).toBe('loc-1');
  });

  it('запрошенная площадка вне области даёт пустую выдачу, а не всю область', () => {
    const { repo, findMany } = makeRepo();

    repo.findAllByCompany(COMPANY, { locationIds: ['loc-1', 'loc-2'], locationId: 'loc-9' });

    expect(findMany.mock.calls[0][0].where.locationId).toEqual({ in: [] });
  });

  it('без области фильтр по площадке применяется как есть', () => {
    const { repo, findMany } = makeRepo();

    repo.findAllByCompany(COMPANY, { locationId: 'loc-1' });

    expect(findMany.mock.calls[0][0].where.locationId).toBe('loc-1');
  });

  it('область площадок сужает запрос', () => {
    const { repo, findMany } = makeRepo();

    repo.findAllByCompany(COMPANY, { locationIds: ['loc-1', 'loc-2'] });

    expect(findMany.mock.calls[0][0].where.locationId).toEqual({ in: ['loc-1', 'loc-2'] });
  });

  it('выдача ограничена по умолчанию: весь парк одним ответом не выгружается', () => {
    const { repo, findMany } = makeRepo();

    repo.findAllByCompany(COMPANY, {});

    expect(findMany.mock.calls[0][0].take).toBe(200);
  });

  it('карточка отдаёт обложку ссылкой на защищённую раздачу', () => {
    const { repo, findMany } = makeRepo();

    repo.findAllByCompany(COMPANY, {});

    const select = findMany.mock.calls[0][0].select;
    expect(select.mainPhoto.select.url).toBe(true);
    expect(select.serialNumber).toBe(true);
  });

  it('findOne тоже ограничен компанией', () => {
    const { repo, findFirst } = makeRepo();

    repo.findOne(COMPANY, 'eq-1');

    expect(findFirst.mock.calls[0][0].where.companyId).toBe(COMPANY);
  });
});

describe('Схема Equipment после V2', () => {
  const schema = readFileSync(join(__dirname, '..', '..', 'prisma', 'schema.prisma'), 'utf8');

  function model(name: string) {
    const match = schema.match(new RegExp(`^model ${name} \\{[\\s\\S]*?^\\}`, 'm'));
    if (!match) throw new Error(`model ${name} not found`);
    return match[0];
  }

  it('связь с заявками сохранена', () => {
    expect(model('Ticket')).toMatch(/equipment\s+Equipment\?\s+@relation/);
    expect(model('Equipment')).toMatch(/tickets\s+Ticket\[\]/);
  });

  it('связь с обходами сохранена', () => {
    // Обходы V1 живут в InspectionRun/InspectionSchedule — на них опирается 103.
    expect(model('Equipment')).toMatch(/inspectionRuns\s+InspectionRun\[\]/);
    expect(model('Equipment')).toMatch(/inspectionSchedules\s+InspectionSchedule\[\]/);
    expect(model('InspectionRun')).toMatch(/equipment\s+Equipment\?/);
  });

  it('удаление обложки не удаляет саму единицу', () => {
    expect(model('Equipment')).toMatch(/mainPhoto[\s\S]*?onDelete: SetNull/);
  });

  it('снимки принадлежат компании и уходят вместе с единицей', () => {
    const attachment = model('EquipmentAttachment');
    expect(attachment).toMatch(/companyId\s+String/);
    expect(attachment).toMatch(/equipment\s+Equipment\s+@relation\("EquipmentAttachments"[\s\S]*?onDelete: Cascade/);
  });

  it('паспортные поля необязательные: существующие строки остаются валидными', () => {
    const equipment = model('Equipment');
    for (const field of [
      'manufacturer',
      'model',
      'serialNumber',
      'inventoryNumber',
      'description',
    ]) {
      expect(equipment).toMatch(new RegExp(`${field}\\s+String\\?`));
    }
    expect(equipment).toMatch(/commissionedAt\s+DateTime\?/);
    expect(equipment).toMatch(/warrantyUntil\s+DateTime\?/);
  });

  it('status остаётся строкой — enum без продуктового решения по INACTIVE небезопасен', () => {
    expect(model('Equipment')).toMatch(/status String @default\("ACTIVE"\)/);
  });
});

describe('Миграция 202609090001', () => {
  const sql = readFileSync(
    join(
      __dirname,
      '..',
      '..',
      'prisma',
      'migrations',
      '202609090001_equipment_v2_passport_and_photo',
      'migration.sql',
    ),
    'utf8',
  );

  it('только добавляет: ни DROP, ни NOT NULL без значения по умолчанию', () => {
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(sql).not.toMatch(/ALTER COLUMN[\s\S]*?SET NOT NULL/i);
  });

  it('внешние ключи добавляются под проверкой существования', () => {
    // Частично применённую миграцию нужно уметь довести, а не уронить на
    // «constraint already exists».
    const guarded = sql.match(/IF NOT EXISTS \(SELECT 1 FROM pg_constraint WHERE conname = '[^']+'\)/g) ?? []
    const added = sql.match(/ADD CONSTRAINT "[^"]+"\s*\n?\s*FOREIGN KEY/g) ?? []
    expect(added.length).toBeGreaterThan(0)
    expect(guarded.length).toBe(added.length)
  })

  it('повторный прогон безопасен', () => {
    const statements = sql.match(/^(ALTER TABLE|CREATE TABLE|CREATE INDEX|CREATE UNIQUE INDEX)/gim) ?? [];
    expect(statements.length).toBeGreaterThan(0);
    for (const line of sql.split('\n')) {
      if (/^\s*(CREATE TABLE|CREATE INDEX|CREATE UNIQUE INDEX)/i.test(line)) {
        expect(line).toMatch(/IF NOT EXISTS/i);
      }
      if (/^\s*ADD COLUMN/i.test(line)) {
        expect(line).toMatch(/IF NOT EXISTS/i);
      }
    }
  });
});
