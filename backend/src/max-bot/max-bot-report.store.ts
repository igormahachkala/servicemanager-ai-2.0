import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

import type { ScreenEntry } from './max-bot-screen-journal';

/**
 * Error reports on disk (no Prisma).
 * Host path: /opt/maxbot_reports (override with MAX_BOT_REPORTS_DIR).
 * Compose mounts host /opt/maxbot_reports -> container /opt/maxbot_reports for backend.
 * Layout: YYYY/MM/DD/<reportId>/report.json + photo-NN.<ext>
 */

export const DEFAULT_MAX_BOT_REPORTS_DIR = '/opt/maxbot_reports';

export type MaxBotReportPhotoInput = {
  buffer: Buffer;
  /** Original filename hint; extension is kept when safe. */
  originalname?: string | null;
  mimetype?: string | null;
};

export type MaxBotErrorReportInput = {
  maxUserId: string;
  userId?: string | null;
  companyId?: string | null;
  role?: string | null;
  text?: string | null;
  photos?: MaxBotReportPhotoInput[];
  screens: ScreenEntry[];
};

export type MaxBotErrorReportJson = {
  id: string;
  createdAt: string;
  type: 'error';
  maxUserId: string;
  userId: string | null;
  companyId: string | null;
  role: string | null;
  text: string;
  photos: string[];
  screens: ScreenEntry[];
};

export type MaxBotErrorReportResult = {
  report: MaxBotErrorReportJson;
  dir: string;
  reportPath: string;
};

function resolveReportsDir(explicit?: string): string {
  const fromEnv = (explicit ?? process.env.MAX_BOT_REPORTS_DIR ?? '').trim();
  return fromEnv || DEFAULT_MAX_BOT_REPORTS_DIR;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function reportDateParts(date: Date): { year: string; month: string; day: string } {
  return {
    year: String(date.getUTCFullYear()),
    month: pad2(date.getUTCMonth() + 1),
    day: pad2(date.getUTCDate()),
  };
}

function safeExtension(originalname?: string | null, mimetype?: string | null): string {
  const fromName = (originalname || '').split('.').pop()?.toLowerCase() ?? '';
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) return fromName;
  const mime = (mimetype || '').toLowerCase();
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return 'bin';
}

@Injectable()
export class MaxBotReportStore {
  constructor(private readonly baseDir = resolveReportsDir()) {}

  getBaseDir(): string {
    return this.baseDir;
  }

  async createErrorReport(input: MaxBotErrorReportInput): Promise<MaxBotErrorReportResult> {
    const createdAt = new Date();
    const id = randomUUID();
    const { year, month, day } = reportDateParts(createdAt);
    const dir = join(this.baseDir, year, month, day, id);
    await mkdir(dir, { recursive: true });

    const photoNames: string[] = [];
    const photos = input.photos ?? [];
    for (let i = 0; i < photos.length; i += 1) {
      const photo = photos[i];
      const ext = safeExtension(photo.originalname, photo.mimetype);
      const filename = `photo-${pad2(i + 1)}.${ext}`;
      await writeFile(join(dir, filename), photo.buffer);
      photoNames.push(filename);
    }

    const report: MaxBotErrorReportJson = {
      id,
      createdAt: createdAt.toISOString(),
      type: 'error',
      maxUserId: input.maxUserId,
      userId: input.userId ?? null,
      companyId: input.companyId ?? null,
      role: input.role ?? null,
      text: input.text ?? '',
      photos: photoNames,
      screens: input.screens.map((entry) => ({
        ...entry,
        buttons: entry.buttons.map((row) => [...row]),
      })),
    };

    const reportPath = join(dir, 'report.json');
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    return { report, dir, reportPath };
  }
}
