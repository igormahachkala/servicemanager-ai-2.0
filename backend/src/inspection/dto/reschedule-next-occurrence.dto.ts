import { IsDateString, Matches } from 'class-validator';

/** Explicit instants only: a device-local date without an offset is ambiguous. */
export const INSTANT_WITH_ZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

export class RescheduleNextOccurrenceDto {
  @IsDateString({ strict: true })
  @Matches(INSTANT_WITH_ZONE)
  nextDueAt!: string;

  @IsDateString({ strict: true })
  @Matches(INSTANT_WITH_ZONE)
  expectedNextDueAt!: string;

  @IsDateString({ strict: true })
  @Matches(INSTANT_WITH_ZONE)
  expectedUpdatedAt!: string;
}
