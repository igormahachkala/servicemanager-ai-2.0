import { NotificationChannel } from '@prisma/client';
import { IsBoolean, IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * SMA-NOTIFICATION-PREFERENCES-UI-105C.
 * Ключ события проверяется по каталогу в сервисе — здесь только форма.
 */
export class UpdateNotificationPreferenceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  eventType!: string;

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @IsBoolean()
  enabled!: boolean;
}

export class ClearNotificationPreferenceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  eventType!: string;

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;
}
