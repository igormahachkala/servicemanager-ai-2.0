import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body for POST /auth/max. Same shape as CreateMaxBindingDto: only signed initData.
 * maxUserId is never accepted from the client.
 */
export class CreateMaxSessionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8192)
  initData!: string;
}
