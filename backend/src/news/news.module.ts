import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { PushModule } from '../push/push.module';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';

/**
 * Новости платформы (Фаза A: backend). Импортирует PushModule для рассылки
 * push при публикации (PushService.sendToUser с типом 'news').
 */
@Module({
  imports: [PrismaModule, PushModule],
  controllers: [NewsController],
  providers: [NewsService],
  exports: [NewsService],
})
export class NewsModule {}
