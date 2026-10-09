import { UserRole } from '@prisma/client';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { MaxBotReportDialog } from './max-bot-report-dialog';
import { MaxBotReportStore } from './max-bot-report.store';
import { MaxBotScreenJournal } from './max-bot-screen-journal';
import type { MaxIncomingMedia } from './max-file.client';

const identity = {
  resolved: true as const,
  userId: 'user-1',
  companyId: 'company-1',
  role: UserRole.TECHNICIAN,
  maxUserId: '4242',
};

function photoMedia(url = 'https://cdn.example/shot.jpg'): MaxIncomingMedia {
  return {
    url,
    token: null,
    type: 'image',
    filename: 'shot.jpg',
    size: 12,
    mime: 'image/jpeg',
  };
}

function payloadsOf(response: { attachments?: { payload: { buttons: { payload: string }[][] } }[] }) {
  return response.attachments?.[0]?.payload.buttons.flat().map((button) => button.payload) || [];
}

describe('MaxBotReportDialog', () => {
  let baseDir: string;
  let journal: MaxBotScreenJournal;
  let store: MaxBotReportStore;
  let files: { download: jest.Mock };
  let dialog: MaxBotReportDialog;

  beforeEach(async () => {
    baseDir = await mkdtemp(join(tmpdir(), 'maxbot-report-dialog-'));
    journal = new MaxBotScreenJournal();
    process.env.MAX_BOT_REPORTS_DIR = baseDir;
    store = new MaxBotReportStore();
    files = {
      download: jest.fn().mockResolvedValue({
        buffer: Buffer.from('jpeg-bytes'),
        size: 10,
        mimetype: 'image/jpeg',
        originalname: 'shot.jpg',
      }),
    };
    dialog = new MaxBotReportDialog(journal, store, files as any);
    journal.push('4242', {
      at: '2026-10-08T10:00:00.000Z',
      kind: 'menu',
      text: 'Меню техника',
      buttons: [['Сегодня', 'Моя смена']],
    });
  });

  afterEach(async () => {
    delete process.env.MAX_BOT_REPORTS_DIR;
    await rm(baseDir, { recursive: true, force: true });
  });

  it('saves text-only report after skipping photo', async () => {
    const prompt = dialog.begin(identity);
    expect(prompt.skipJournal).toBe(true);
    expect(prompt.kind).toBe('report:prompt');
    expect(prompt.text).toContain('Опишите ошибку');

    const afterText = await dialog.submitContent(identity, 'кнопка зависла', []);
    expect(afterText?.kind).toBe('report:ask-photo');
    expect(payloadsOf(afterText!)).toContain('report:skip-photo');

    const sent = await dialog.handleCallback(identity, 'report:skip-photo');
    expect(sent.text).toBe('Отправлено. Спасибо.');
    expect(sent.skipJournal).toBe(true);
    expect(sent.kind).toBe('report:sent');
    expect(payloadsOf(sent)).toContain('menu');

    const saved = await readLatestReport();
    expect(saved.text).toBe('кнопка зависла');
    expect(saved.photos).toEqual([]);
    expect(saved.screens).toHaveLength(1);
    expect(saved.screens[0].kind).toBe('menu');
  });

  it('saves photo-only report after skipping text', async () => {
    dialog.begin(identity);
    const afterPhoto = await dialog.submitContent(identity, '', [photoMedia()]);
    expect(afterPhoto?.kind).toBe('report:ask-text');
    expect(payloadsOf(afterPhoto!)).toContain('report:skip-text');

    const sent = await dialog.handleCallback(identity, 'report:skip-text');
    expect(sent.text).toBe('Отправлено. Спасибо.');
    expect(files.download).toHaveBeenCalledTimes(1);

    const saved = await readLatestReport();
    expect(saved.text).toBe('');
    expect(saved.photos).toEqual(['photo-01.jpg']);
  });

  it('saves text and photo together without ask steps', async () => {
    dialog.begin(identity);
    const sent = await dialog.submitContent(identity, 'оба сразу', [photoMedia()]);
    expect(sent?.text).toBe('Отправлено. Спасибо.');
    expect(sent?.kind).toBe('report:sent');

    const saved = await readLatestReport();
    expect(saved.text).toBe('оба сразу');
    expect(saved.photos).toEqual(['photo-01.jpg']);
  });

  it('lets user add text after photo via Добавить', async () => {
    dialog.begin(identity);
    await dialog.submitContent(identity, '', [photoMedia()]);
    const awaitText = await dialog.handleCallback(identity, 'report:add-text');
    expect(awaitText.kind).toBe('report:await-text');

    const sent = await dialog.submitContent(identity, 'дописал текст', []);
    expect(sent?.text).toBe('Отправлено. Спасибо.');

    const saved = await readLatestReport();
    expect(saved.text).toBe('дописал текст');
    expect(saved.photos).toEqual(['photo-01.jpg']);
  });

  it('lets user add photo after text via Добавить', async () => {
    dialog.begin(identity);
    await dialog.submitContent(identity, 'сначала текст', []);
    const awaitPhoto = await dialog.handleCallback(identity, 'report:add-photo');
    expect(awaitPhoto.kind).toBe('report:await-photo');

    const sent = await dialog.submitContent(identity, '', [photoMedia()]);
    expect(sent?.text).toBe('Отправлено. Спасибо.');

    const saved = await readLatestReport();
    expect(saved.text).toBe('сначала текст');
    expect(saved.photos).toEqual(['photo-01.jpg']);
  });

  it('saves journal-only report when user skips text and photo', async () => {
    dialog.begin(identity);
    const askPhoto = await dialog.handleCallback(identity, 'report:skip-text');
    expect(askPhoto.kind).toBe('report:ask-photo');

    const sent = await dialog.handleCallback(identity, 'report:skip-photo');
    expect(sent.text).toBe('Отправлено. Спасибо.');

    const saved = await readLatestReport();
    expect(saved.text).toBe('');
    expect(saved.photos).toEqual([]);
    expect(saved.screens).toEqual([
      {
        at: '2026-10-08T10:00:00.000Z',
        kind: 'menu',
        text: 'Меню техника',
        buttons: [['Сегодня', 'Моя смена']],
      },
    ]);
    expect(files.download).not.toHaveBeenCalled();
  });

  it('cancels without writing a report', async () => {
    dialog.begin(identity);
    const cancelled = await dialog.handleCallback(identity, 'report:cancel');
    expect(cancelled.text).toBe('Отменено.');
    expect(cancelled.kind).toBe('report:cancelled');
    expect(payloadsOf(cancelled)).toContain('menu');
    expect(cancelled.skipJournal).toBe(true);

    const entries = await listReportDirs();
    expect(entries).toEqual([]);
  });

  it('freezes journal snapshot at form entry', async () => {
    dialog.begin(identity);
    journal.push('4242', {
      at: '2026-10-08T11:00:00.000Z',
      kind: 'today',
      text: 'после входа',
      buttons: [],
    });
    await dialog.submitContent(identity, 'срез', []);
    await dialog.handleCallback(identity, 'report:skip-photo');

    const saved = await readLatestReport();
    expect(saved.screens).toHaveLength(1);
    expect(saved.screens[0].kind).toBe('menu');
  });

  async function readLatestReport() {
    const dirs = await listReportDirs();
    expect(dirs.length).toBe(1);
    const raw = await readFile(join(dirs[0], 'report.json'), 'utf8');
    return JSON.parse(raw) as {
      text: string;
      photos: string[];
      screens: Array<{ kind: string; text: string; at: string; buttons: string[][] }>;
    };
  }

  async function listReportDirs(): Promise<string[]> {
    const { readdir } = await import('fs/promises');
    const years = await readdir(baseDir).catch(() => [] as string[]);
    const out: string[] = [];
    for (const year of years) {
      const months = await readdir(join(baseDir, year));
      for (const month of months) {
        const days = await readdir(join(baseDir, year, month));
        for (const day of days) {
          const ids = await readdir(join(baseDir, year, month, day));
          for (const id of ids) out.push(join(baseDir, year, month, day, id));
        }
      }
    }
    return out;
  }
});
