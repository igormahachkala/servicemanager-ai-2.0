import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NewsStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';

const DEFAULT_TAKE = 20;
const MAX_TAKE = 100;
const BROADCAST_BATCH = 100;

/**
 * Новости платформы. Авторинг — PLATFORM_ADMIN; лента и push — всем пользователям.
 * При публикации — fire-and-forget рассылка push батчами (news-тумблер уважается
 * внутри PushService.sendToUser). Deep-link из push: /m/news/:id.
 */
@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  // ---------- admin (PLATFORM_ADMIN) ----------

  create(authorId: string, dto: CreateNewsDto) {
    return this.prisma.news.create({
      data: {
        title: dto.title,
        body: dto.body,
        coverImageUrl: dto.coverImageUrl ?? null,
        authorId,
        status: NewsStatus.DRAFT,
      },
    });
  }

  async update(id: string, dto: UpdateNewsDto) {
    await this.mustExist(id);
    return this.prisma.news.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
        ...(dto.coverImageUrl !== undefined
          ? { coverImageUrl: dto.coverImageUrl }
          : {}),
      },
    });
  }

  /** Публикация: перевод в PUBLISHED (идемпотентно) + запуск рассылки push. */
  async publish(id: string) {
    const news = await this.mustExist(id);
    const published =
      news.status === NewsStatus.PUBLISHED
        ? news
        : await this.prisma.news.update({
            where: { id },
            data: { status: NewsStatus.PUBLISHED, publishedAt: new Date() },
          });

    // fire-and-forget: publish-ответ не ждёт рассылку (fan-out в фоне).
    void this.broadcast(published.id).catch((err) =>
      this.logger.warn({ err, newsId: published.id }, 'news_broadcast_failed'),
    );

    return published;
  }

  adminList() {
    return this.prisma.news.findMany({
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async remove(id: string) {
    await this.mustExist(id);
    await this.prisma.news.delete({ where: { id } });
    return { ok: true as const, id };
  }

  // ---------- user (все роли) ----------

  /** Лента: только PUBLISHED, пагинация, с флагом readAt для запрашивающего пользователя. */
  async feed(userId: string, params: { take?: number; offset?: number }) {
    const take = Math.min(Math.max(params.take ?? DEFAULT_TAKE, 1), MAX_TAKE);
    const offset = Math.max(params.offset ?? 0, 0);
    const items = await this.prisma.news.findMany({
      where: { status: NewsStatus.PUBLISHED },
      orderBy: { publishedAt: 'desc' },
      skip: offset,
      take: take + 1, // +1 для hasMore
      include: { reads: { where: { userId }, select: { readAt: true } } },
    });
    const hasMore = items.length > take;
    const page = hasMore ? items.slice(0, take) : items;
    return {
      items: page.map((n) => this.toFeedItem(n)),
      hasMore,
      nextOffset: hasMore ? offset + take : null,
    };
  }

  async getOne(userId: string, id: string) {
    const news = await this.prisma.news.findFirst({
      where: { id, status: NewsStatus.PUBLISHED },
      include: { reads: { where: { userId }, select: { readAt: true } } },
    });
    if (!news) throw new NotFoundException('News not found');
    return this.toFeedItem(news);
  }

  async markRead(userId: string, id: string) {
    const news = await this.prisma.news.findFirst({
      where: { id, status: NewsStatus.PUBLISHED },
      select: { id: true },
    });
    if (!news) throw new NotFoundException('News not found');
    await this.prisma.newsRead.upsert({
      where: { newsId_userId: { newsId: id, userId } },
      create: { newsId: id, userId },
      update: {},
    });
    return { ok: true as const };
  }

  /** Непрочитано = PUBLISHED новостей минус те, что пользователь прочитал. */
  async unreadCount(userId: string) {
    const [published, read] = await Promise.all([
      this.prisma.news.count({ where: { status: NewsStatus.PUBLISHED } }),
      this.prisma.newsRead.count({
        where: { userId, news: { status: NewsStatus.PUBLISHED } },
      }),
    ]);
    return { unreadCount: Math.max(published - read, 0) };
  }

  // ---------- broadcast ----------

  /**
   * Рассылка push о новости всем подходящим получателям, батчами.
   * Получатель: активный пользователь ∧ есть активная push-подписка ∧ news не выключен
   * (отсутствие строки настроек = включено, дефолт news=true).
   * TODO(scale): при росте аудитории/требовании устойчивости к рестарту — вынести в
   *   outbox-таблицу + фоновый воркер (как SlaWorkerService). Сейчас — in-process fan-out.
   */
  async broadcast(newsId: string) {
    const news = await this.prisma.news.findUnique({ where: { id: newsId } });
    if (!news || news.status !== NewsStatus.PUBLISHED) return { recipients: 0 };

    const recipients = await this.prisma.user.findMany({
      where: {
        isActive: true,
        pushSubscriptions: { some: { disabledAt: null } },
        OR: [{ pushPreference: null }, { pushPreference: { news: true } }],
      },
      select: { id: true },
    });

    const payload = {
      title: news.title,
      body: this.preview(news.body),
      tag: `news:${news.id}`,
      navigate: `/m/news/${news.id}`,
    };

    for (let i = 0; i < recipients.length; i += BROADCAST_BATCH) {
      const batch = recipients.slice(i, i + BROADCAST_BATCH);
      await Promise.all(
        batch.map((u) =>
          this.push.sendToUser(u.id, payload, 'news', news.id).catch((err) => {
            this.logger.warn({ err, userId: u.id, newsId }, 'news_push_failed');
            return 0;
          }),
        ),
      );
    }
    return { recipients: recipients.length };
  }

  // ---------- helpers ----------

  private async mustExist(id: string) {
    const news = await this.prisma.news.findUnique({ where: { id } });
    if (!news) throw new NotFoundException('News not found');
    return news;
  }

  private toFeedItem(news: {
    id: string;
    title: string;
    body: string;
    coverImageUrl: string | null;
    publishedAt: Date | null;
    createdAt: Date;
    reads?: { readAt: Date }[];
  }) {
    return {
      id: news.id,
      title: news.title,
      body: news.body,
      coverImageUrl: news.coverImageUrl,
      publishedAt: news.publishedAt,
      createdAt: news.createdAt,
      readAt: news.reads && news.reads.length ? news.reads[0].readAt : null,
    };
  }

  private preview(body: string, max = 140) {
    const text = (body || '').replace(/\s+/g, ' ').trim();
    return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
  }
}
