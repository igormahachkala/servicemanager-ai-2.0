import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';

import { CreateNewsDto } from './dto/create-news.dto';
import { ListNewsQueryDto } from './dto/list-news-query.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { NewsService } from './news.service';

/** Роли, которым доступна лента (все аутентифицированные, включая CLIENT). */
const FEED_ROLES = [
  UserRole.ADMIN,
  UserRole.MASTER,
  UserRole.DISPATCHER,
  UserRole.NETWORK_DIRECTOR,
  UserRole.TECHNICIAN,
  UserRole.CLIENT,
  UserRole.TERRITORIAL_MANAGER,
  UserRole.STAFF,
  UserRole.PLATFORM_ADMIN,
] as const;

/**
 * Новости платформы. Авторинг — только PLATFORM_ADMIN; лента — все роли.
 * Auth как везде: JwtAuthGuard + RolesGuard. Статические маршруты объявлены
 * ДО параметрических (`:id`), чтобы не перехватывались.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('news')
export class NewsController {
  constructor(private readonly news: NewsService) {}

  // ---- user (все роли) ----

  @Get()
  @Roles(...FEED_ROLES)
  feed(@Req() req: any, @Query() q: ListNewsQueryDto) {
    return this.news.feed(req.user.id, { take: q.take, offset: q.offset });
  }

  @Get('unread-count')
  @Roles(...FEED_ROLES)
  unreadCount(@Req() req: any) {
    return this.news.unreadCount(req.user.id);
  }

  // ---- admin (PLATFORM_ADMIN) ----

  @Get('admin')
  @Roles(UserRole.PLATFORM_ADMIN)
  adminList() {
    return this.news.adminList();
  }

  @Post()
  @Roles(UserRole.PLATFORM_ADMIN)
  create(@Req() req: any, @Body() dto: CreateNewsDto) {
    return this.news.create(req.user.id, dto);
  }

  @Post(':id/publish')
  @Roles(UserRole.PLATFORM_ADMIN)
  publish(@Param('id') id: string) {
    return this.news.publish(id);
  }

  @Patch(':id')
  @Roles(UserRole.PLATFORM_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateNewsDto) {
    return this.news.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.PLATFORM_ADMIN)
  remove(@Param('id') id: string) {
    return this.news.remove(id);
  }

  // ---- user single-item (param routes last) ----

  @Get(':id')
  @Roles(...FEED_ROLES)
  getOne(@Req() req: any, @Param('id') id: string) {
    return this.news.getOne(req.user.id, id);
  }

  @Post(':id/read')
  @Roles(...FEED_ROLES)
  markRead(@Req() req: any, @Param('id') id: string) {
    return this.news.markRead(req.user.id, id);
  }
}
