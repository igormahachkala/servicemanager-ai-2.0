import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { ManagementSurface } from '../common/management-surface-access';
import {
  PublishProductUpdateDto,
  UpsertProductUpdateDto,
} from './dto/product-update.dto';
import { ProductUpdatesService } from './product-updates.service';
import type { ProductUpdateActor } from './product-updates.policy';

function actorOf(req: any): ProductUpdateActor {
  return {
    id: req.user.id,
    role: req.user.role,
    companyId: req.user.companyId ?? null,
  };
}

/**
 * Центр обновлений.
 *
 * Чтение — любой авторизованный пользователь; что именно он видит, решает
 * сервис (опубликовано + своя компания или глобальное + его роль).
 * Ведение — PLATFORM_ADMIN (глобальные карточки) и ADMIN компании (карточки
 * своей компании) с доступом к управленческой части.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('product-updates')
export class ProductUpdatesController {
  constructor(private readonly svc: ProductUpdatesService) {}

  @Get()
  listPublished(@Req() req: any) {
    return this.svc.listPublished(actorOf(req));
  }

  @Get('manage')
  @ManagementSurface()
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.ADMIN)
  listManaged(@Req() req: any) {
    return this.svc.listManaged(actorOf(req));
  }

  @Get(':id')
  getPublished(@Req() req: any, @Param('id') id: string) {
    return this.svc.getPublished(actorOf(req), id);
  }

  @Post()
  @ManagementSurface()
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.ADMIN)
  create(@Req() req: any, @Body() dto: UpsertProductUpdateDto) {
    return this.svc.create(actorOf(req), dto);
  }

  @Patch(':id')
  @ManagementSurface()
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.ADMIN)
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpsertProductUpdateDto,
  ) {
    return this.svc.update(actorOf(req), id, dto);
  }

  @Post(':id/publish')
  @ManagementSurface()
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.ADMIN)
  publish(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: PublishProductUpdateDto,
  ) {
    return this.svc.publish(actorOf(req), id, dto);
  }

  @Post(':id/unpublish')
  @ManagementSurface()
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.ADMIN)
  unpublish(@Req() req: any, @Param('id') id: string) {
    return this.svc.unpublish(actorOf(req), id);
  }

  @Delete(':id')
  @ManagementSurface()
  @Roles(UserRole.PLATFORM_ADMIN, UserRole.ADMIN)
  removeDraft(@Req() req: any, @Param('id') id: string) {
    return this.svc.removeDraft(actorOf(req), id);
  }
}
