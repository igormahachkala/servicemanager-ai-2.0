import { join } from 'path';

import {
  loadMemosManifest,
  MEMOS_PAGE_SIZE,
  memosVisibleForRole,
  parseMemosAction,
  renderMemosListMessage,
  resetMemosManifestCache,
  selectMemosForBatch,
} from './max-bot-memos';
import { MaxBotMemosService } from './max-bot-memos.service';
import { MaxFileClient } from './max-file.client';

const ASSETS = join(process.cwd(), 'assets', 'max-bot-memos');

function labelsOf(response: ReturnType<typeof renderMemosListMessage>) {
  return response.attachments?.[0]?.payload.buttons.flat().map((button) => button.text) || [];
}

describe('max-bot-memos', () => {
  beforeEach(() => resetMemosManifestCache());

  it('loads the committed memos.json with technician/master/common contours', () => {
    const memos = loadMemosManifest(ASSETS);
    expect(memos.length).toBe(53);
    expect(memos.filter((item) => item.contour === 'technician')).toHaveLength(26);
    expect(memos.filter((item) => item.contour === 'master')).toHaveLength(22);
    expect(memos.filter((item) => item.contour === 'common')).toHaveLength(5);
    expect(memos.every((item) => item.file.endsWith('.png') && item.title.length <= 40)).toBe(true);
  });

  it('filters list buttons by role contour and keeps ≤2 buttons per memo row', () => {
    const tech = renderMemosListMessage('technician', 0, loadMemosManifest(ASSETS));
    const master = renderMemosListMessage('master', 0, loadMemosManifest(ASSETS));
    const techVisible = memosVisibleForRole('technician', loadMemosManifest(ASSETS));
    const masterVisible = memosVisibleForRole('master', loadMemosManifest(ASSETS));

    expect(techVisible).toHaveLength(31);
    expect(masterVisible).toHaveLength(27);
    expect(labelsOf(tech)).toContain('Получить все памятки');
    expect(labelsOf(tech)).toContain('Получить все памятки мастера');
    expect(labelsOf(tech)).toContain('Получить все памятки техника');
    expect(labelsOf(tech)).toContain('Сообщить об ошибке');
    expect(labelsOf(tech)).toContain('Меню');

    const memoRows = (tech.attachments?.[0]?.payload.buttons || []).filter((row) =>
      row.every((button) => button.type === 'callback' && button.payload.startsWith('memo:')),
    );
    expect(memoRows.length).toBeGreaterThan(0);
    expect(memoRows.every((row) => row.length <= 2)).toBe(true);
    expect(memoRows.flat()).toHaveLength(Math.min(MEMOS_PAGE_SIZE, techVisible.length));

    expect(labelsOf(master).some((label) => label.includes('мастера') || label === 'Меню мастера')).toBe(
      true,
    );
  });

  it('paginates when there are more memos than one page', () => {
    const page0 = renderMemosListMessage('technician', 0, loadMemosManifest(ASSETS));
    const page1 = renderMemosListMessage('technician', 1, loadMemosManifest(ASSETS));
    expect(labelsOf(page0)).toContain('Следующие');
    expect(labelsOf(page0)).not.toContain('Предыдущие');
    expect(labelsOf(page1)).toContain('Предыдущие');
    expect(parseMemosAction('memos:p:1')).toEqual({ kind: 'list', page: 1 });
    expect(parseMemosAction('memo:tech-today')).toEqual({ kind: 'one', id: 'tech-today' });
    expect(parseMemosAction('memos:all:m')).toEqual({ kind: 'all', scope: 'master' });
  });

  it('selects batch sets by scope', () => {
    const entries = loadMemosManifest(ASSETS);
    expect(selectMemosForBatch('technician', 'master', entries)).toHaveLength(26);
    expect(selectMemosForBatch('master', 'technician', entries)).toHaveLength(22);
    expect(selectMemosForBatch('role', 'technician', entries)).toHaveLength(31);
    expect(selectMemosForBatch('role', 'master', entries)).toHaveLength(27);
  });
});

describe('MaxBotMemosService', () => {
  beforeEach(() => resetMemosManifestCache());

  it('uploads and sends one memo through MaxFileClient without file:// payloads', async () => {
    const uploaded: string[] = [];
    const sent: Array<{ chatId: number; caption: string; token: string }> = [];
    const files = {
      uploadImage: jest.fn(async (_buffer: Buffer, filename: string) => {
        uploaded.push(filename);
        expect(filename.endsWith('.png')).toBe(true);
        return `token-${filename}`;
      }),
      sendImageMessage: jest.fn(async (chatId: number, caption: string, token: string) => {
        sent.push({ chatId, caption, token });
      }),
    } as unknown as MaxFileClient;

    const service = new MaxBotMemosService(files);
    service.configureForTests({ assetsDir: ASSETS, sleep: async () => undefined });

    const memo = loadMemosManifest(ASSETS).find((item) => item.id === 'tech-today')!;
    await service.sendOne(4242, memo);

    expect(files.uploadImage).toHaveBeenCalledTimes(1);
    expect(uploaded).toEqual(['tech-today.png']);
    expect(sent).toEqual([{ chatId: 4242, caption: 'Сегодня техника', token: 'token-tech-today.png' }]);
    expect(JSON.stringify(sent)).not.toContain('file://');
  });

  it('batch-sends selected memos with delays between batches and reports the count', async () => {
    const sleeps: number[] = [];
    const files = {
      uploadImage: jest.fn(async () => 'tok'),
      sendImageMessage: jest.fn(async () => undefined),
    } as unknown as MaxFileClient;
    const service = new MaxBotMemosService(files);
    service.configureForTests({
      assetsDir: ASSETS,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });

    const batch = selectMemosForBatch('technician', 'technician', loadMemosManifest(ASSETS)).slice(0, 10);
    const count = await service.sendBatch(7, batch);
    expect(count).toBe(10);
    expect(files.sendImageMessage).toHaveBeenCalledTimes(10);
    expect(sleeps.length).toBe(1);

    const response = await service.handleCallback(
      {
        callback: {
          payload: 'memos:all:t',
          chat_id: 7,
        },
      },
      'memos:all:t',
      'technician',
    );
    expect(response.text).toMatch(/^Отправлено \d+ памяток$/);
    const buttons = JSON.stringify(response.attachments ?? []);
    expect(buttons).toContain("\"text\":\"Назад\"");
    expect(buttons).toContain("\"payload\":\"memos\"");
  });
});
