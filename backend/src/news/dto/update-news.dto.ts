import { IsOptional, IsString, MaxLength } from 'class-validator';

/** PATCH /news/:id — правка новости (только PLATFORM_ADMIN). Все поля опциональны. */
export class UpdateNewsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  coverImageUrl?: string;
}
