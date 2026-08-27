import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * SMA-MAX-SECURE-USER-BINDING-054.
 *
 * The request body carries exactly one field, and deliberately so.
 *
 * There is no `maxUserId`, no `email` and no `userId` here: the MAX identity is read from
 * the signed payload and the ServiceManager identity from the session. Accepting either as
 * an input would let a caller assert an identity instead of proving one.
 */
export class CreateMaxBindingDto {
  /**
   * `window.WebApp.initData` verbatim — the signed WebAppData string.
   *
   * Bounded to keep an oversized body away from HMAC work. Real payloads are well under
   * a kilobyte; `start_param` alone is capped at 512 characters by MAX.
   */
  @IsString()
  @MinLength(1)
  @MaxLength(8192)
  initData!: string;
}
