export const BOT_TICKET_FILE_LIMIT_BYTES = 10 * 1024 * 1024;

export type MaxIncomingMedia = {
  url: string | null;
  token: string | null;
  type: string;
  filename: string;
  size: number | null;
  mime: string | null;
};

export type DownloadedMaxFile = {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname: string;
};

const MEDIA_TYPES = new Set(['image', 'video', 'file']);

export function extractMaxIncomingMedia(update: unknown): MaxIncomingMedia[] {
  if (!update || typeof update !== 'object') return [];
  const root = update as Record<string, unknown>;
  const message = asRecord(root.message);
  const body = asRecord(message?.body);
  const lists = [body?.attachments, message?.attachments, root.attachments];
  const out: MaxIncomingMedia[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const media = toIncomingMedia(item);
      if (!media) continue;
      const key = `${media.url ?? ''}|${media.token ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(media);
    }
  }
  return out;
}

export class MaxFileClient {
  constructor(
    private readonly baseUrl = (process.env.MAX_BOT_API_BASE_URL || 'https://platform-api2.max.ru').replace(/\/+$/, ''),
    private readonly token = (process.env.MAX_BOT_API_TOKEN || '').trim(),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async download(media: MaxIncomingMedia): Promise<DownloadedMaxFile> {
    if (media.size !== null && media.size > BOT_TICKET_FILE_LIMIT_BYTES) {
      throw new Error('Файл больше 10 МБ');
    }
    const url = media.url || (await this.resolveTokenUrl(media.token, media.type));
    if (!url) throw new Error('Не удалось получить фото');
    const response = await this.fetchImpl(url);
    if (!response.ok) throw new Error('Не удалось получить фото');
    const length = Number(response.headers.get('content-length'));
    if (Number.isFinite(length) && length > BOT_TICKET_FILE_LIMIT_BYTES) {
      throw new Error('Файл больше 10 МБ');
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > BOT_TICKET_FILE_LIMIT_BYTES) throw new Error('Файл больше 10 МБ');
    if (buffer.length === 0) throw new Error('Не удалось получить фото');
    const mime =
      media.mime ||
      response.headers.get('content-type')?.split(';')[0].trim() ||
      guessMime(media.filename, media.type);
    return {
      buffer,
      size: buffer.length,
      mimetype: mime,
      originalname: media.filename || defaultName(media.type, mime),
    };
  }

  private async resolveTokenUrl(token: string | null, type: string): Promise<string | null> {
    if (!token || !this.token) return null;
    const path = type === 'video' ? `/videos/${encodeURIComponent(token)}` : `/files/${encodeURIComponent(token)}`;
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      headers: { Authorization: this.token },
    });
    if (!response.ok) return null;
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return null;
    const payload = asRecord(body.payload);
    const url = body.url ?? payload?.url;
    return typeof url === 'string' && url.trim() ? url.trim() : null;
  }
}

function toIncomingMedia(item: unknown): MaxIncomingMedia | null {
  const record = asRecord(item);
  if (!record) return null;
  const type = String(record.type || '').toLowerCase();
  if (!MEDIA_TYPES.has(type)) return null;
  const payload = asRecord(record.payload) || record;
  const url = readString(payload.url);
  const token = readString(payload.token);
  if (!url && !token) return null;
  const sizeRaw = payload.size ?? record.size;
  const size = typeof sizeRaw === 'number' && Number.isFinite(sizeRaw) ? sizeRaw : null;
  return {
    url,
    token,
    type,
    filename: readString(payload.filename) || readString(record.filename) || '',
    size,
    mime: readString(payload.mimeType) || readString(record.mime_type),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function guessMime(filename: string, type: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic') return 'image/heic';
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'mov') return 'video/quicktime';
  if (type === 'video') return 'video/mp4';
  return 'image/jpeg';
}

function defaultName(type: string, mime: string) {
  if (mime === 'image/png') return 'photo.png';
  if (mime === 'video/mp4' || type === 'video') return 'video.mp4';
  return 'photo.jpg';
}
