import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Optional signed MAX payload from Mini App logout.
 *
 * There is no `maxUserId` field: the MAX identity is read from the signed payload.
 * Without initData the revoke stays on the JWT user, for ordinary browser logout.
 */
export class RevokeMaxBindingDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(8192)
  initData?: string;
}
