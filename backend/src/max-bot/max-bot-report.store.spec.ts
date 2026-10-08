import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { MaxBotReportStore, reportDateParts } from './max-bot-report.store';

describe('MaxBotReportStore', () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = await mkdtemp(join(tmpdir(), 'maxbot-reports-'));
  });

  afterEach(async () => {
    delete process.env.MAX_BOT_REPORTS_DIR;
    await rm(baseDir, { recursive: true, force: true });
  });

  it('writes report.json and photos under YYYY/MM/DD/<id>/', async () => {
    process.env.MAX_BOT_REPORTS_DIR = baseDir;
    const store = new MaxBotReportStore();
    const created = await store.createErrorReport({
      maxUserId: '42',
      userId: 'user-1',
      companyId: 'company-1',
      role: 'TECHNICIAN',
      text: 'кнопка не работает',
      photos: [
        { buffer: Buffer.from('fake-jpeg'), originalname: 'shot.jpg', mimetype: 'image/jpeg' },
      ],
      screens: [
        {
          at: '2026-10-08T10:00:00.000Z',
          kind: 'menu',
          text: 'Меню',
          buttons: [['Сегодня', 'Заявки']],
        },
      ],
    });

    const { year, month, day } = reportDateParts(new Date(created.report.createdAt));
    expect(created.dir).toBe(join(baseDir, year, month, day, created.report.id));
    expect(created.report.type).toBe('error');
    expect(created.report.maxUserId).toBe('42');
    expect(created.report.companyId).toBe('company-1');
    expect(created.report.photos).toEqual(['photo-01.jpg']);
    expect(created.report.screens).toHaveLength(1);

    const raw = await readFile(created.reportPath, 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.id).toBe(created.report.id);
    expect(parsed.photos).toEqual(['photo-01.jpg']);

    const photoBytes = await readFile(join(created.dir, 'photo-01.jpg'));
    expect(photoBytes.equals(Buffer.from('fake-jpeg'))).toBe(true);
  });

  it('allows empty text and no photos', async () => {
    process.env.MAX_BOT_REPORTS_DIR = baseDir;
    const store = new MaxBotReportStore();
    const created = await store.createErrorReport({
      maxUserId: '7',
      screens: [],
    });
    expect(created.report.text).toBe('');
    expect(created.report.photos).toEqual([]);
    expect(created.report.userId).toBeNull();
    expect(created.report.companyId).toBeNull();
  });

  it('never uses /opt when base dir is tmp', () => {
    process.env.MAX_BOT_REPORTS_DIR = baseDir;
    const store = new MaxBotReportStore();
    expect(store.getBaseDir()).toBe(baseDir);
    expect(store.getBaseDir().startsWith('/opt')).toBe(false);
  });
});
