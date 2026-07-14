import { IsOptional, IsString, IsNotEmpty, MaxLength } from 'class-validator';

/** POST /news — создание черновика новости (только PLATFORM_ADMIN). */
export class CreateNewsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  coverImageUrl?: string;
}
