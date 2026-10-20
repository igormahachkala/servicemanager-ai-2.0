import { ApiProperty } from '@nestjs/swagger';

/**
 * Один permission-блок из каталога (read-only справочник для UI).
 * `code` — это реальный PermissionBlock.code (UPPER_SNAKE), который понимает guard.
 */
export class PermissionCatalogItemDto {
  @ApiProperty({ example: 'TICKETS_VIEW', description: 'Канонический код права (PermissionBlock.code)' })
  code!: string;

  @ApiProperty({ example: 'View tickets', description: 'Человекочитаемое имя права' })
  name!: string;

  @ApiProperty({ example: 'Tickets', description: 'Категория/группа для группировки в UI' })
  category!: string;

  @ApiProperty({ required: false, nullable: true, example: 'Просмотр доски/списка/карточки', description: 'Описание' })
  description?: string | null;
}

export class PermissionCatalogResponseDto {
  @ApiProperty({ type: [PermissionCatalogItemDto] })
  blocks!: PermissionCatalogItemDto[];
}
