import { Type } from 'class-transformer'
import { InspectionCheckpointResponseType } from '@prisma/client'
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'

class CreateTemplateItemDto {
  @IsString()
  @MaxLength(160)
  title!: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number

  @IsOptional()
  @IsString()
  @MaxLength(120)
  zoneName?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  zoneSortOrder?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  checkpointSortOrder?: number

  @IsOptional()
  @IsEnum(InspectionCheckpointResponseType)
  responseType?: InspectionCheckpointResponseType

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  numericMin?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  numericMax?: number

  @IsOptional()
  @IsString()
  @MaxLength(32)
  numericUnit?: string

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean
}

export class CreateTemplateDto {
  @IsString()
  @MaxLength(160)
  name!: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateTemplateItemDto)
  items!: CreateTemplateItemDto[]
}
