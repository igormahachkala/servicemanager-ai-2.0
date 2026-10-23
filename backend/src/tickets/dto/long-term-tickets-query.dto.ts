import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { IsCanonicalUuid } from '../../common/validators/is-canonical-uuid.decorator';
import { LONG_TERM_MAX_LIMIT } from '../long-term-tickets';

/** SMA-MOBILE-LONG-TERM-TICKETS — GET /tickets/long-term/count. Контур — как у board. */
export class LongTermTicketsCountQueryDto {
  @IsOptional()
  @IsCanonicalUuid()
  linkedClientCompanyId?: string;

  @IsOptional()
  @IsCanonicalUuid()
  companyId?: string;
}

/** SMA-MOBILE-LONG-TERM-TICKETS — GET /tickets/long-term. */
export class LongTermTicketsQueryDto extends LongTermTicketsCountQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LONG_TERM_MAX_LIMIT)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;
}
