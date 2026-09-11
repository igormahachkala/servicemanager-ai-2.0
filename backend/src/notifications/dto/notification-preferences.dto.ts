import {
  NotificationChannel,
  NotificationContour,
  UserRole,
} from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class UpdateCompanyNotificationRolePreferenceDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsEnum(NotificationContour)
  contour!: NotificationContour;

  @IsEnum(UserRole)
  role!: UserRole;

  @IsString()
  eventType!: string;

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean | null;
}

export class UpdateUserNotificationPreferenceDto {
  @IsEnum(NotificationContour)
  contour!: NotificationContour;

  @IsString()
  eventType!: string;

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean | null;
}
