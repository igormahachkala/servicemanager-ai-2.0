import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class ProductUpdateMediaDto {
  @IsString()
  @MaxLength(2000)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  caption?: string;
}

export class UpsertProductUpdateDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  changes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  howToUse?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  featurePath?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ProductUpdateMediaDto)
  media?: ProductUpdateMediaDto[];

  @IsOptional()
  @IsArray()
  @IsIn(Object.values(UserRole), { each: true })
  audienceRoles?: UserRole[];
}

export class PublishProductUpdateDto {
  /** Явное подтверждение публикации администратором. Без true публикации нет. */
  @IsBoolean()
  confirm!: boolean;
}
