import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class PushKeysDto {
  @IsString()
  @IsNotEmpty()
  p256dh!: string;

  @IsString()
  @IsNotEmpty()
  auth!: string;
}

/**
 * POST /push/subscriptions — контракт фронта (web/src/lib/api.ts subscribeToPushBackend
 * и web/public/sw.js pushsubscriptionchange). endpoint уникален; keys приходят вложенным
 * объектом из PushSubscription.toJSON().
 */
export class SubscribePushDto {
  @IsString()
  @IsNotEmpty()
  endpoint!: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsBoolean()
  declarative?: boolean;
}
