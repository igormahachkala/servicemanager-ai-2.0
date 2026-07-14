import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** GET /news — пагинация ленты (transform+implicit conversion в global ValidationPipe). */
export class ListNewsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
